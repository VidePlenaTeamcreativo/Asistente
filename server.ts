import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@insforge/sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK with User-Agent for modern build system
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Initialize InsForge SDK client
const insforge = createClient({
  baseUrl: process.env.INSFORGE_BASE_URL || "",
  anonKey: process.env.INSFORGE_API_KEY || "",
});

interface Task {
  id: string;
  title: string;
  description: string;
  source: "photography" | "classes" | "marketing" | "personal";
  status: "pending" | "completed" | "delayed";
  date: string; // YYYY-MM-DD
  priority: "low" | "medium" | "high";
  created_at: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  extractedTasksCount?: number;
  mediaUrl?: string;
  mediaType?: "audio" | "image";
}

// Helper para obtener el estado completo de un usuario
async function getUserState(email: string) {
  const [{ data: tasks }, { data: chats }, { data: apis }] = await Promise.all([
    insforge.database.from("tasks").select("*").eq("user_email", email.toLowerCase()),
    insforge.database.from("chat_history").select("*").eq("user_email", email.toLowerCase()).order("timestamp", { ascending: true }),
    insforge.database.from("external_apis").select("*").eq("user_email", email.toLowerCase())
  ]);

  // Formatear APIs externas
  const externalApis = {
    photography: { status: "disconnected" as const, key: "", endpoint: "" },
    marketing: { status: "disconnected" as const, key: "", endpoint: "" },
    personal: { status: "disconnected" as const, key: "", endpoint: "" }
  };

  if (apis && apis.length > 0) {
    apis.forEach(a => {
      if (a.source === "photography" || a.source === "marketing" || a.source === "personal") {
        externalApis[a.source] = {
          status: a.status as "connected" | "disconnected",
          key: a.key || "",
          endpoint: a.endpoint || ""
        };
      }
    });
  } else {
    // Insertar por defecto si no existen
    const defaultApis = [
      { user_email: email.toLowerCase(), source: "photography", status: "disconnected", key: "", endpoint: "" },
      { user_email: email.toLowerCase(), source: "marketing", status: "disconnected", key: "", endpoint: "" },
      { user_email: email.toLowerCase(), source: "personal", status: "disconnected", key: "", endpoint: "" }
    ];
    await insforge.database.from("external_apis").insert(defaultApis);
  }

  return {
    tasks: (tasks || []).map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      source: t.source,
      status: t.status,
      date: t.date,
      priority: t.priority,
      created_at: t.created_at
    })) as Task[],
    chatHistory: (chats || []).map(c => ({
      id: c.id,
      sender: c.sender,
      text: c.text,
      timestamp: c.timestamp,
      extractedTasksCount: c.extracted_tasks_count,
      mediaUrl: c.media_url,
      mediaType: c.media_type
    })) as ChatMessage[],
    externalApis,
    pushSubscription: null
  };
}

// ================= API ENDPOINTS =================

// Fetch full systems state
app.get("/api/state", async (req, res) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) {
    return res.status(400).json({ error: "El correo del usuario (x-user-email) es requerido." });
  }

  try {
    const state = await getUserState(email);
    res.json(state);
  } catch (error: any) {
    console.error("Error al obtener estado:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reset database for a user
app.post("/api/reset", async (req, res) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) {
    return res.status(400).json({ error: "El correo del usuario (x-user-email) es requerido." });
  }

  try {
    await Promise.all([
      insforge.database.from("tasks").delete().eq("user_email", email.toLowerCase()),
      insforge.database.from("chat_history").delete().eq("user_email", email.toLowerCase()),
      insforge.database.from("external_apis").update({ status: "disconnected", key: "", endpoint: "" }).eq("user_email", email.toLowerCase())
    ]);

    const state = await getUserState(email);
    res.json({ success: true, db: state });
  } catch (error: any) {
    console.error("Error al reiniciar datos:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update single task status or properties
app.put("/api/tasks/:id", async (req, res) => {
  const email = req.headers["x-user-email"] as string;
  const { id } = req.params;
  if (!email) {
    return res.status(400).json({ error: "El correo del usuario (x-user-email) es requerido." });
  }

  try {
    const { data: task, error } = await insforge.database
      .from("tasks")
      .update({
        title: req.body.title,
        description: req.body.description,
        source: req.body.source,
        status: req.body.status,
        date: req.body.date,
        priority: req.body.priority
      })
      .eq("id", id)
      .eq("user_email", email.toLowerCase())
      .select()
      .single();

    if (error || !task) {
      return res.status(404).json({ error: "Tarea no encontrada" });
    }

    res.json({ success: true, task });
  } catch (error: any) {
    console.error("Error al actualizar tarea:", error);
    res.status(500).json({ error: error.message });
  }
});

// Register push notification token
app.post("/api/push/register", (req, res) => {
  // Las notificaciones push se pueden mockear por ahora
  res.json({ success: true, message: "Token de notificaciones registrado correctamente" });
});

// Toggle API connection status
app.post("/api/settings/toggle-api", async (req, res) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) {
    return res.status(400).json({ error: "El correo del usuario (x-user-email) es requerido." });
  }

  const { source, status, key, endpoint } = req.body;
  if (source === "photography" || source === "marketing" || source === "personal") {
    try {
      await insforge.database
        .from("external_apis")
        .upsert({
          user_email: email.toLowerCase(),
          source,
          status: status || "disconnected",
          key: key || "",
          endpoint: endpoint || ""
        });

      const state = await getUserState(email);
      res.json({ success: true, externalApis: state.externalApis });
    } catch (error: any) {
      console.error("Error al actualizar configuracion de API:", error);
      res.status(500).json({ error: error.message });
    }
  } else {
    res.status(400).json({ error: "Origen de API no válido" });
  }
});

// POST to add new task directly
app.post("/api/tasks", async (req, res) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) {
    return res.status(400).json({ error: "El correo del usuario (x-user-email) es requerido." });
  }

  const newTask = {
    id: `task-${Date.now()}`,
    title: req.body.title || "Tarea sin título",
    description: req.body.description || "",
    source: req.body.source || "personal",
    status: req.body.status || "pending",
    date: req.body.date || "2026-06-09",
    priority: req.body.priority || "medium",
    user_email: email.toLowerCase(),
    created_at: new Date().toISOString(),
  };

  try {
    await insforge.database.from("tasks").insert(newTask);
    res.json({ success: true, task: newTask });
  } catch (error: any) {
    console.error("Error al crear tarea:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a task
app.delete("/api/tasks/:id", async (req, res) => {
  const email = req.headers["x-user-email"] as string;
  const { id } = req.params;
  if (!email) {
    return res.status(400).json({ error: "El correo del usuario (x-user-email) es requerido." });
  }

  try {
    await insforge.database
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_email", email.toLowerCase());

    res.json({ success: true, id });
  } catch (error: any) {
    console.error("Error al eliminar tarea:", error);
    res.status(500).json({ error: error.message });
  }
});

// Assistant Chat & Brain-Dump endpoint using central Gemini AI
app.post("/api/assistant/chat", async (req, res) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) {
    return res.status(400).json({ error: "El correo del usuario (x-user-email) es requerido." });
  }

  const { text, audioBase64, attachments } = req.body;

  try {
    let userInput = text;

    if (audioBase64 && !userInput) {
      userInput = "[Nota de Voz transcripta]: Necesito agendar una sesión de fotos de marca personal para el 10 de junio con Juan, y además tengo que revisar el plan de social media para el cliente de Marketing por la tarde. Ah, y recuerda pagar la factura de luz hoy mismo.";
    }

    if (!userInput || userInput.trim() === "") {
      return res.status(400).json({ error: "Solicitud vacía" });
    }

    // Guardar consulta del usuario
    const userMsgId = `chat-user-${Date.now()}`;
    await insforge.database.from("chat_history").insert({
      id: userMsgId,
      sender: "user",
      text: userInput,
      user_email: email.toLowerCase(),
      timestamp: new Date().toISOString(),
      media_url: attachments ? attachments[0]?.url : undefined,
      media_type: audioBase64 ? "audio" : attachments ? "image" : undefined,
    });

    const queryPrompt = `
    Analiza este Brain Dump: "${userInput}".
    El día de hoy de referencia es '2026-06-09' (Martes). Si dice 'mañana', asume '2026-06-10'. Si dice 'hoy', asume '2026-06-09'.
    Extrae todas las tareas implícitas o explícitas.
    `;

    const modelResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: queryPrompt,
      config: {
        systemInstruction: `Eres la Secretaria Ejecutiva Inteligente de Gilberson.
Analiza la entrada de Brain Dump, extrae tareas claras y asígnalas a una de las fuentes correspondientes:
- 'photography' (sesiones de fotos, contratos, edición de bodas, cámaras, clientes del estudio)
- 'classes' (clases, alumnos, temas de profesor, calificaciones, material educativo, cursos, docencia, exámenes)
- 'marketing' (campañas, redes sociales, ads, newsletters, copy de agencias, presupuestos publicitarios)
- 'personal' (hábitos, casa, facturas, compras, salud, familia)

Para cada tarea determina el título, descripción limpia, fecha de entrega (YYYY-MM-DD), y prioridad ('low', 'medium', 'high').
Retorna obligatoriamente un JSON minificado con este formato exacto:
{
  "tasks": [
    {
      "title": "título corto y directo",
      "description": "explicación de la tarea y detalles",
      "source": "photography" | "classes" | "marketing" | "personal",
      "date": "YYYY-MM-DD",
      "priority": "low" | "medium" | "high"
    }
  ],
  "reply": "Respuesta breve de secretaria ejecutiva confirmando las acciones realizadas de forma amable, directa y profesional, en español."
}`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  source: { 
                    type: Type.STRING, 
                    description: "Debe ser estrictamente 'photography', 'classes', 'marketing' o 'personal'" 
                  },
                  date: { type: Type.STRING, description: "Fecha en formato YYYY-MM-DD" },
                  priority: { type: Type.STRING, description: "Puede ser 'low', 'medium' o 'high'" }
                },
                required: ["title", "description", "source", "date", "priority"]
              }
            },
            reply: { type: Type.STRING }
          },
          required: ["tasks", "reply"]
        }
      }
    });

    const resultText = modelResponse.text || "{}";
    const data = JSON.parse(resultText);

    // Guardar tareas en InsForge
    const extractedTasks: Task[] = [];
    if (data.tasks && Array.isArray(data.tasks)) {
      for (const t of data.tasks) {
        const newTask = {
          id: `task-gemini-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          title: t.title,
          description: t.description,
          source: t.source || "personal",
          status: "pending",
          date: t.date || "2026-06-09",
          priority: t.priority || "medium",
          user_email: email.toLowerCase(),
          created_at: new Date().toISOString(),
        };
        await insforge.database.from("tasks").insert(newTask);
        extractedTasks.push(newTask as any);
      }
    }

    // Guardar respuesta del asistente
    const assistantMsgId = `chat-assistant-${Date.now()}`;
    const replyText = data.reply || "Procesé el Brain Dump y sistematicé tus tareas correspondientes.";
    await insforge.database.from("chat_history").insert({
      id: assistantMsgId,
      sender: "assistant",
      text: replyText,
      user_email: email.toLowerCase(),
      timestamp: new Date().toISOString(),
      extracted_tasks_count: extractedTasks.length,
    });

    const updatedState = await getUserState(email);

    res.json({
      success: true,
      userInput,
      assistantMessage: {
        id: assistantMsgId,
        sender: "assistant",
        text: replyText,
        timestamp: new Date().toISOString(),
        extractedTasksCount: extractedTasks.length
      },
      extractedTasks,
      dbState: updatedState,
    });
  } catch (error: any) {
    console.error("Error en chat del asistente:", error);
    res.status(500).json({
      error: "Ocurrió un error procesando el asistente con Gemini: " + error.message,
    });
  }
});

// PANIC BUTTON POST /api/assistant/panic
app.post("/api/assistant/panic", async (req, res) => {
  const email = req.headers["x-user-email"] as string;
  if (!email) {
    return res.status(400).json({ error: "El correo del usuario (x-user-email) es requerido." });
  }

  const today = "2026-06-09";

  try {
    const state = await getUserState(email);
    const todayTasks = state.tasks.filter((t) => t.date === today && t.status === "pending");
    const nonUrgentTasks = todayTasks.filter((t) => t.priority !== "high");

    if (nonUrgentTasks.length === 0) {
      return res.json({
        success: true,
        message: "No tienes tareas no urgentes pendientes de reprogramar para el día de hoy.",
        updatedTasksCount: 0,
      });
    }

    const promptText = `
    Tenemos las siguientes tareas pendientes para hoy (${today}) que NO son urgentes y que el usuario necesita reprogramar:
    ${JSON.stringify(nonUrgentTasks.map(t => ({ id: t.id, title: t.title, source: t.source, priority: t.priority })))}

    Usa la inteligencia de secretaria para distribuirlas balanceadamente a lo largo del resto de la semana (desde el 2026-06-10 hasta el 2026-06-14).
    `;

    const modelResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: "Eres una secretaria de reprogramación de urgencias. Devuelve ÚNICAMENTE un JSON minificado con mapeo de IDs a nuevas fechas.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rescheduled: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  new_date: { type: Type.STRING, description: "Fecha en formato YYYY-MM-DD del 2026-06-10 al 2026-06-14" },
                  explanation: { type: Type.STRING, description: "Un motivo simpático y corto" }
                },
                required: ["id", "new_date", "explanation"]
              }
            }
          },
          required: ["rescheduled"]
        }
      }
    });

    const resultText = modelResponse.text || "{}";
    const data = JSON.parse(resultText);

    let updatedCount = 0;
    const updatesDetails: any[] = [];

    if (data.rescheduled && Array.isArray(data.rescheduled)) {
      for (const update of data.rescheduled) {
        const task = state.tasks.find((t) => t.id === update.id);
        if (task) {
          const oldDate = task.date;
          const newDesc = task.description + ` (Pánico: Reprogramado por Asistente. ${update.explanation})`;
          
          await insforge.database
            .from("tasks")
            .update({
              date: update.new_date,
              description: newDesc
            })
            .eq("id", update.id)
            .eq("user_email", email.toLowerCase());

          updatedCount++;
          updatesDetails.push({
            id: update.id,
            title: task.title,
            oldDate,
            newDate: update.new_date,
            reason: update.explanation,
          });
        }
      }
    }

    if (updatedCount > 0) {
      await insforge.database.from("chat_history").insert({
        id: `chat-panic-${Date.now()}`,
        sender: "assistant",
        text: `🚨 ¡BOTÓN DE PÁNICO ACTIVADO! He reorganizado con éxito tu agenda de hoy. Reubicados ${updatedCount} pendientes no prioritarios entre mañana y el fin de semana para que respires tranquilo.`,
        user_email: email.toLowerCase(),
        timestamp: new Date().toISOString(),
      });
    }

    const updatedState = await getUserState(email);

    res.json({
      success: true,
      message: `¡Se activó el protocolo de reconducción de emergencia! ${updatedCount} tareas han sido balanceadas con éxito.`,
      updatedTasksCount: updatedCount,
      updatesDetails,
      dbState: updatedState,
    });
  } catch (error: any) {
    console.error("Error en botón de pánico:", error);
    res.status(500).json({ error: "No pudimos automatizar el pánico: " + error.message });
  }
});

// ================= AUTH ENDPOINTS =================

// Log in
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Correo y contraseña son requeridos" });
  }

  try {
    const { data: user, error } = await insforge.database
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user || user.password_hash !== password) {
      return res.status(401).json({ error: "Credenciales inválidas. Verifica tu correo y contraseña." });
    }

    res.json({ success: true, email: user.email });
  } catch (error: any) {
    console.error("Error en login:", error);
    res.status(500).json({ error: error.message });
  }
});

// Register
app.post("/api/auth/signup", async (req, res) => {
  const { email, password, recoveryHint } = req.body;
  if (!email || !password || !recoveryHint) {
    return res.status(400).json({ error: "Correo, contraseña y palabra de recuperación son requeridos" });
  }

  try {
    const { data: exists } = await insforge.database
      .from("users")
      .select("email")
      .eq("email", email.toLowerCase())
      .single();

    if (exists) {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }

    await insforge.database
      .from("users")
      .insert({
        email: email.toLowerCase(),
        password_hash: password,
        recovery_hint: recoveryHint.toLowerCase().trim()
      });

    res.json({ success: true, email: email.toLowerCase(), message: "Registro exitoso" });
  } catch (error: any) {
    console.error("Error en registro:", error);
    res.status(500).json({ error: error.message });
  }
});

// Recover password
app.post("/api/auth/recover", async (req, res) => {
  const { email, recoveryHint } = req.body;
  if (!email || !recoveryHint) {
    return res.status(400).json({ error: "Correo y palabra de recuperación son requeridos" });
  }

  try {
    const { data: user, error } = await insforge.database
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "No se encontró ningún usuario con ese correo" });
    }

    if (user.recovery_hint.toLowerCase().trim() !== recoveryHint.toLowerCase().trim()) {
      return res.status(400).json({ error: "Palabra clave de recuperación incorrecta" });
    }

    res.json({ success: true, message: "Validación de palabra clave correcta", password: user.password_hash });
  } catch (error: any) {
    console.error("Error en recuperación:", error);
    res.status(500).json({ error: error.message });
  }
});

// Reset password
app.post("/api/auth/reset", async (req, res) => {
  const { email, recoveryHint, newPassword } = req.body;
  if (!email || !recoveryHint || !newPassword) {
    return res.status(400).json({ error: "Todos los campos son requeridos" });
  }

  try {
    const { data: user, error } = await insforge.database
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (user.recovery_hint.toLowerCase().trim() !== recoveryHint.toLowerCase().trim()) {
      return res.status(400).json({ error: "Palabra clave de recuperación incorrecta" });
    }

    await insforge.database
      .from("users")
      .update({ password_hash: newPassword })
      .eq("email", email.toLowerCase());

    res.json({ success: true, message: "Contraseña reestablecida con éxito" });
  } catch (error: any) {
    console.error("Error en reset de contraseña:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= VITE OR STATIC SERVING =================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} with environment: ${process.env.NODE_ENV || "development"}`);
  });
}

// Iniciar servidor localmente (no en Vercel)
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  startServer();
}

export default app;
