import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Calendar, 
  Clock, 
  CheckSquare, 
  Sliders, 
  Mic, 
  MicOff, 
  Paperclip, 
  Send, 
  AlertTriangle, 
  Bell, 
  Database, 
  TrendingUp, 
  Key, 
  Smartphone, 
  Check, 
  Camera, 
  Briefcase, 
  Home, 
  RefreshCw, 
  Sparkles, 
  Info,
  Trash2,
  Lock,
  Wifi,
  Battery,
  User,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  Mail,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Interfaces
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

interface ExternalApi {
  status: "connected" | "disconnected";
  key: string;
  endpoint: string;
}

interface DBState {
  tasks: Task[];
  chatHistory: ChatMessage[];
  externalApis: {
    photography: ExternalApi;
    marketing: ExternalApi;
    personal: ExternalApi;
  };
  pushSubscription: any | null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "itinerary" | "calendar" | "settings">("chat");
  const [db, setDb] = useState<DBState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>("");
  const [voiceRecording, setVoiceRecording] = useState<boolean>(false);
  const [recordingTimer, setRecordingTimer] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>("2026-06-09"); // today
  const [sendingChat, setSendingChat] = useState<boolean>(false);
  const [panicking, setPanicking] = useState<boolean>(false);
  const [showNotificationGuide, setShowNotificationGuide] = useState<boolean>(false);
  const [profileSubView, setProfileSubView] = useState<"main" | "config" | "integrations">("main");
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(() => {
    try {
      const saved = localStorage.getItem("pwa_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [rememberEmail, setRememberEmail] = useState<boolean>(() => {
    return localStorage.getItem("remember_email") === "true";
  });
  const [authView, setAuthView] = useState<"login" | "signup" | "recover" | "reset">("login");
  const [authEmail, setAuthEmail] = useState<string>(() => {
    return localStorage.getItem("remembered_email") || "";
  });
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authRecoveryHint, setAuthRecoveryHint] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [authSuccess, setAuthSuccess] = useState<string>("");
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!authEmail || !authPassword) {
      setAuthError("Debe ingresar correo y contraseña.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Fallo en el inicio de sesión");
      }
      
      // Save user session
      const userObj = { email: data.email };
      setCurrentUser(userObj);
      localStorage.setItem("pwa_user", JSON.stringify(userObj));
      
      // Handle remember email
      if (rememberEmail) {
        localStorage.setItem("remember_email", "true");
        localStorage.setItem("remembered_email", authEmail);
      } else {
        localStorage.setItem("remember_email", "false");
        localStorage.removeItem("remembered_email");
      }
      
      setAuthPassword("");
      addLog(`🔐 Sesión iniciada para ${data.email}`);
    } catch (err: any) {
      setAuthError(err.message);
      addLog(`❌ Error de inicio de sesión: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!authEmail || !authPassword || !authRecoveryHint) {
      setAuthError("Todos los campos son obligatorios.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: authEmail, 
          password: authPassword, 
          recoveryHint: authRecoveryHint 
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Fallo en el registro");
      }
      
      setAuthSuccess("¡Registro exitoso! Ya puedes iniciar sesión.");
      setAuthPassword("");
      setAuthRecoveryHint("");
      setAuthView("login");
      addLog(`📝 Nuevo usuario registrado: ${data.email}`);
    } catch (err: any) {
      setAuthError(err.message);
      addLog(`❌ Error de registro: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Recover Password
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!authEmail || !authRecoveryHint) {
      setAuthError("Ingresa el correo y la palabra de recuperación.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, recoveryHint: authRecoveryHint })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo recuperar la contraseña");
      }
      
      setAuthSuccess(`Tu contraseña es: "${data.password}". Por favor, anótala y vuelve a iniciar sesión.`);
      addLog(`🔑 Clave recuperada con éxito para ${authEmail}`);
    } catch (err: any) {
      setAuthError(err.message);
      addLog(`❌ Error de recuperación: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Password Reset
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    if (!authEmail || !authRecoveryHint || !authPassword) {
      setAuthError("Todos los campos son obligatorios.");
      return;
    }
    setIsAuthLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: authEmail, 
          recoveryHint: authRecoveryHint, 
          newPassword: authPassword 
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo reestablecer la contraseña");
      }
      
      setAuthSuccess("¡Contraseña reestablecida con éxito! Ya puedes iniciar sesión.");
      setAuthPassword("");
      setAuthRecoveryHint("");
      setAuthView("login");
      addLog(`🔒 Clave reestablecida para ${authEmail}`);
    } catch (err: any) {
      setAuthError(err.message);
      addLog(`❌ Error de reestablecimiento: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("pwa_user");
    addLog("🚪 Sesión cerrada por el usuario.");
  };

  // Simulated terminal logs to show users the background Supabase Edge Function API proxy activity
  const [logs, setLogs] = useState<string[]>([
    "[SYSTEM] Inicializando Secretaria Ejecutiva...",
    "[SUPABASE] Conectado a la DB persistente en local container.",
    "[PWA] Service Worker registrado en scope /",
  ]);

  // Floating Mock PWA Web Push alert
  const [floatingAlert, setFloatingAlert] = useState<{ title: string; body: string; source: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial state from database
  const fetchState = async () => {
    if (!currentUser?.email) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/state", {
        headers: {
          "x-user-email": currentUser.email
        }
      });
      const data = await res.json();
      setDb(data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching state:", err);
      // Fallback if server and dev compilation hasn't fully booted
      setTimeout(fetchState, 2000);
    }
  };

  useEffect(() => {
    fetchState();
  }, [currentUser?.email]);

  // Log message helper
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [db?.chatHistory, activeTab]);

  // Handle task status toggles
  const handleToggleTask = async (task: Task) => {
    if (!db) return;
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    
    addLog(`🔄 Sincronizando cambio de estado: '${task.title}' -> ${nextStatus}`);
    addLog(`🔑 Usando API Proxy seguro de Supabase Edge en /api/tasks/${task.id}`);
    
    // Call simulated external sync log based on source
    const apiSpec = db.externalApis[task.source];
    if (apiSpec.status === "connected") {
      addLog(`📡 POST webhook enviado a: ${apiSpec.endpoint}`);
      addLog(`🔒 Encrypted Key cabecera: Bearer ${apiSpec.key.substring(0, 15)}...`);
    } else {
      addLog(`⚠️ Advertencia: El sistema externo de '${task.source}' está desconectado. Cambio guardado localmente.`);
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-user-email": currentUser?.email || ""
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setDb((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
          };
        });
        addLog(`✅ Sincronización exitosa para '${task.title}'`);
      }
    } catch (err) {
      console.error("Error toggling task:", err);
    }
  };

  // Trigger floating delayed task PWA Alert simulation
  const simulateTaskDelay = (task: Task) => {
    addLog(`⚠️ [ALERTA DELAY] Detectado retraso en tarea: '${task.title}'`);
    addLog(`📡 Supabase Edge Function Webhook disparado debido a retraso.`);
    
    setFloatingAlert({
      title: `⚠️ Alerta de Retraso de Agenda`,
      body: `La tarea '${task.title}' (${task.source.toUpperCase()}) se encuentra retrasada. Se ha notificado a tus contactos vinculados.`,
      source: task.source,
    });

    // Auto dismiss after 7 seconds
    setTimeout(() => {
      setFloatingAlert(null);
    }, 7000);
  };

  // Send message to Gemini Central assistant
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || chatInput;
    if (!textToSend.trim() && !voiceRecording) return;

    setSendingChat(true);
    setChatInput("");
    addLog(`🧠 Enviando brain dump al LLM por medio de Supabase Edge Function...`);
    addLog(`✨ Optimizando Prompt con prompt caching para responder con JSON comprimido.`);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-email": currentUser?.email || ""
        },
        body: JSON.stringify({
          text: textToSend,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setDb(data.dbState);
        addLog(`✨ Gemini procesó con éxito. Extraídas ${data.extractedTasks?.length || 0} nuevas tareas.`);
        
        if (data.extractedTasks && data.extractedTasks.length > 0) {
          data.extractedTasks.forEach((t: Task) => {
            addLog(`➕ Tarea Agregada: '${t.title}' asignada a ${t.source.toUpperCase()}`);
          });
        }
      }
    } catch (err) {
      console.error("Error sending message to assistant:", err);
      addLog(`❌ Error procesando el asistente con Gemini.`);
    } finally {
      setSendingChat(false);
    }
  };

  // Play simulated audio recording
  const handleMicToggle = () => {
    if (voiceRecording) {
      // Stop recording
      setVoiceRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecordingTimer(0);
      
      // Send preset simulated audio transcript text to trigger actual Gemini task extract
      const mockVoiceTranscript = "Gilberson, agenda para mañana 10 de junio a las 11am una revisión de la galería del estudio fotográfico con el cliente Carlos, y recuérdame por la noche programar las publicaciones de marketing para la agencia de viajes en Instagram.";
      addLog(`🎤 Nota de voz grabada con éxito. Procesando espectro de audio y transcribiendo...`);
      handleSendMessage(mockVoiceTranscript);
    } else {
      // Start recording
      setVoiceRecording(true);
      setRecordingTimer(0);
      addLog(`🎤 Micrófono encendido. Grabando nota de voz del 'Brain Dump'...`);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTimer((prev) => prev + 1);
      }, 1000);
    }
  };

  // Clean recording interval on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Panic Button Rescheduling (Gemini Automation)
  const triggerPanicButton = async () => {
    setPanicking(true);
    addLog(`🚨 Botón de Pánico presionado. Solicitando reprogramación automática a la Inteligencia Artificial...`);
    addLog(`🧠 Reubicando tareas no urgentes de hoy (${selectedDate}) para balancear la semana.`);

    try {
      const res = await fetch("/api/assistant/panic", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-email": currentUser?.email || ""
        },
      });
      const data = await res.json();
      if (data.success) {
        setDb(data.dbState);
        addLog(`✅ Reorganización exitosa. Movidas ${data.updatedTasksCount} tareas.`);
        if (data.updatesDetails && data.updatesDetails.length > 0) {
          data.updatesDetails.forEach((up: any) => {
            addLog(`➡️ '${up.title}': de ${up.oldDate} movida a ${up.newDate}. Motivo: ${up.reason}`);
          });
        }
      } else {
        addLog(`⚠️ Alerta: ${data.message}`);
      }
    } catch (err) {
      console.error("Panic button error:", err);
      addLog(`❌ Errores en la función de pánico.`);
    } finally {
      setPanicking(false);
    }
  };

  // Reset demo
  const handleResetDemo = async () => {
    if (confirm("¿Estás seguro de restablecer todos los datos del asistente?")) {
      try {
        const res = await fetch("/api/reset", { 
          method: "POST",
          headers: {
            "x-user-email": currentUser?.email || ""
          }
        });
        const data = await res.json();
        if (data.success) {
          setDb(data.db);
          setSelectedDate("2026-06-09");
          addLog("♻️ Base de datos del demo restablecida completamente.");
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Delete a task
  const handleDeleteTask = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { 
        method: "DELETE",
        headers: {
          "x-user-email": currentUser?.email || ""
        }
      });
      const data = await res.json();
      if (data.success) {
        setDb((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.filter((t) => t.id !== id),
          };
        });
        addLog(`🗑️ Tarea eliminada: '${name}'`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle API connect status via settings
  const handleUpdateApiSettings = async (source: "photography" | "classes" | "marketing" | "personal", status: "connected" | "disconnected", key: string, endpoint: string) => {
    try {
      const res = await fetch("/api/settings/toggle-api", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-email": currentUser?.email || ""
        },
        body: JSON.stringify({ source, status, key, endpoint }),
      });
      const data = await res.json();
      if (data.success) {
        setDb((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            externalApis: data.externalApis,
          };
        });
        addLog(`⚙️ Ajustes de API actualizados para: ${source.toUpperCase()} (${status})`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Render format recording timer
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading || !db) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <Sparkles className="absolute text-emerald-400 w-6 h-6 animate-pulse" />
          </div>
          <p className="font-mono text-xs text-gray-400 tracking-wider">SEC-INTELLIGENT_INIT_v1.0.0</p>
          <p className="text-sm font-light text-gray-300">Cargando Asistente de Planificación...</p>
        </div>
      </div>
    );
  }

  // Helper colors mapping
  const sourceColors: Record<string, { bg: string; text: string; border: string; accent: string; darkBg: string }> = {
    photography: { 
      bg: "bg-blue-50/90", 
      text: "text-blue-800", 
      border: "border-blue-200", 
      accent: "bg-blue-600",
      darkBg: "bg-blue-900/10"
    },
    classes: { 
      bg: "bg-orange-50/90", 
      text: "text-orange-850", 
      border: "border-orange-200", 
      accent: "bg-orange-500",
      darkBg: "bg-orange-950/10"
    },
    marketing: { 
      bg: "bg-purple-50/90", 
      text: "text-purple-800", 
      border: "border-purple-200", 
      accent: "bg-purple-600",
      darkBg: "bg-purple-900/10"
    },
    personal: { 
      bg: "bg-emerald-50/90", 
      text: "text-emerald-800", 
      border: "border-emerald-200", 
      accent: "bg-emerald-600",
      darkBg: "bg-emerald-950/10"
    },
  };

  // Filter tasks based on current selection
  const filteredTasks = db.tasks.filter((t) => t.date === selectedDate);

  // Generate date markers for June 2026 week for Calendar view
  const juneDays = [
    { dayNum: "07", dayStr: "Dom", date: "2026-06-07" },
    { dayNum: "08", dayStr: "Lun", date: "2026-06-08" },
    { dayNum: "09", dayStr: "Mar", date: "2026-06-09" }, // Today
    { dayNum: "10", dayStr: "Mie", date: "2026-06-10" },
    { dayNum: "11", dayStr: "Jue", date: "2026-06-11" },
    { dayNum: "12", dayStr: "Vie", date: "2026-06-12" },
    { dayNum: "13", dayStr: "Sab", date: "2026-06-13" },
    { dayNum: "14", dayStr: "Dom", date: "2026-06-14" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col items-center justify-center antialiased overflow-x-hidden">
      
      {/* FLOATING MOCK WEB PUSH NOTIFICATION BANNER */}
      <AnimatePresence>
        {floatingAlert && (
          <motion.div 
            initial={{ opacity: 0, y: -70, scale: 0.9 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 w-[90%] max-w-sm bg-slate-900/95 border border-amber-500/40 shadow-2xl rounded-xl p-3.5 z-50 text-white flex items-start space-x-3 backdrop-blur-md"
          >
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold font-mono tracking-wider text-amber-400 uppercase">Fallo de Tarea (Delayed)</p>
                <span className="text-[9px] text-gray-400">Ahora mismo</span>
              </div>
              <h4 className="text-xs font-bold text-gray-100 mt-0.5">{floatingAlert.title}</h4>
              <p className="text-xs text-gray-300 mt-1 leading-normal">{floatingAlert.body}</p>
            </div>
            <button 
              onClick={() => setFloatingAlert(null)}
              className="text-xs text-gray-400 hover:text-slate-100 self-start text-[10px] bg-slate-800 px-1.5 py-0.5 rounded"
            >
              Cerrar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MIDDLE CONTAINER: Central Smartphone Sandbox Simulator wrapper to reinforce "Mobile-First" exact execution */}
      <div className="flex-1 flex items-center justify-center p-0 sm:p-4 bg-slate-900 w-full">
        <div className="w-full max-w-md bg-slate-950 sm:rounded-[36px] sm:border-[8px] sm:border-slate-800 shadow-2xl overflow-hidden aspect-[9/19] h-full sm:h-[840px] flex flex-col relative">
          
          {/* Mock Smartphone top hardware bar notch */}
          <div className="hidden sm:flex bg-slate-950 h-6 w-full items-center justify-between px-6 text-[11px] text-slate-400 font-mono shrink-0 select-none border-b border-slate-900/65">
            <span className="font-semibold text-[10px]">12:48 PM</span>
            <div className="w-24 h-4 bg-slate-900 rounded-b-xl flex items-center justify-center">
              <div className="w-12 h-1.5 bg-slate-800 rounded-full"></div>
            </div>
            <div className="flex items-center space-x-1">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px]">PWA</span>
              <Battery className="w-4 h-3 text-emerald-400 ml-0.5" />
            </div>
          </div>

          {/* Smartphone Application Header bar */}
          {currentUser === null ? (
            <div id="auth-header" className="bg-slate-900 px-4 py-4 flex items-center justify-center border-b border-slate-800 shrink-0 select-none">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h1 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Acceso Seguro Supabase Auth</h1>
              </div>
            </div>
          ) : (
            <div id="app-header" className="bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 border border-emerald-500/10 flex items-center justify-center text-white font-extrabold text-sm shadow">
                    {currentUser.email === 'gilbersonhernandezfotografia@gmail.com' ? "SE" : currentUser.email.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute right-0 bottom-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900"></div>
                </div>
                <div>
                  <div className="flex items-center space-x-1">
                    <h1 className="text-xs font-bold tracking-tight text-white">
                      {currentUser.email === 'gilbersonhernandezfotografia@gmail.com' ? "Secretaría Gilberson" : `Asistente de ${currentUser.email.split('@')[0]}`}
                    </h1>
                    <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-[10px] text-slate-400">Asistente Central PWA</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => addLog("🔔 Simulando suscripción a Webhook de Supabase...")}
                  className="p-1 px-2 text-[10px] flex items-center space-x-0.5 font-medium rounded text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20"
                >
                  <Bell className="w-3 h-3" />
                  <span>PWA Push</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEWPORT AREA: Main Dynamic Views container */}
          <div className="flex-1 overflow-y-auto bg-slate-950 p-3.5 relative flex flex-col justify-between">
            <AnimatePresence mode="wait">
              {currentUser === null ? (
                <motion.div
                  key="auth"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col h-full justify-center space-y-4 px-2"
                >
                  <div className="text-center space-y-1.5 mb-2 select-none">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {authView === "login" && "Iniciar Sesión"}
                      {authView === "signup" && "Crear Nueva Cuenta"}
                      {authView === "recover" && "Recuperar Contraseña"}
                      {authView === "reset" && "Restablecer Contraseña"}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {authView === "login" && "Accede a tu panel ejecutivo de PWA."}
                      {authView === "signup" && "Genera tus credenciales con cifrado SSL."}
                      {authView === "recover" && "Ingresa tu palabra de recuperación."}
                      {authView === "reset" && "Establece una nueva llave de acceso."}
                    </p>
                  </div>

                  {authError && (
                    <div id="auth-error-alert" className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium animate-fade-in">
                      {authError}
                    </div>
                  )}

                  {authSuccess && (
                     <div id="auth-success-alert" className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center font-medium animate-fade-in">
                      {authSuccess}
                    </div>
                  )}

                  <form 
                    onSubmit={
                      authView === "login" ? handleLogin :
                      authView === "signup" ? handleSignup :
                      authView === "recover" ? handleRecover :
                      handleReset
                    }
                    className="space-y-3.5"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center space-x-1">
                        <Mail className="w-3 h-3 text-emerald-400 inline" />
                        <span>Correo Electrónico</span>
                      </label>
                      <input 
                        type="email"
                        required
                        placeholder="tu@correo.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600 font-mono"
                      />
                    </div>

                    {(authView === "login" || authView === "signup" || authView === "reset") && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center space-x-1">
                          <Lock className="w-3 h-3 text-emerald-400 inline" />
                          <span>
                            {authView === "reset" ? "Nueva Contraseña" : "Contraseña"}
                          </span>
                        </label>
                        <input 
                          type="password"
                          required
                          placeholder="••••••••"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600 font-mono"
                        />
                      </div>
                    )}

                    {(authView === "signup" || authView === "recover" || authView === "reset") && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center space-x-1">
                          <Key className="w-3 h-3 text-emerald-400 inline" />
                          <span>Palabra Clave de Recuperación</span>
                        </label>
                        <input 
                          type="text"
                          required
                          placeholder="Ej: director, fotografia, marketing"
                          value={authRecoveryHint}
                          onChange={(e) => setAuthRecoveryHint(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
                        />
                        <p className="text-[9px] text-slate-500 leading-normal mt-0.5 select-none">
                          *Se te solicitará exactamente esta palabra para recuperar o reestablecer tu clave si la olvidas.
                        </p>
                      </div>
                    )}

                    {authView === "login" && (
                      <div className="flex items-center justify-between pt-1 select-none">
                        <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={rememberEmail}
                            onChange={(e) => setRememberEmail(e.target.checked)}
                            className="rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-opacity-0 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                          />
                          <span>Recordar correo</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setAuthView("recover");
                            setAuthError("");
                            setAuthSuccess("");
                          }}
                          className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                        >
                          ¿Olvidaste tu clave?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isAuthLoading}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg active:scale-95 disabled:opacity-50 mt-2 cursor-pointer"
                    >
                      {isAuthLoading ? "Procesando..." : (
                        authView === "login" ? "Iniciar Sesión" :
                        authView === "signup" ? "Registrarse" :
                        authView === "recover" ? "Obtener Clave" :
                        "Cambiar Contraseña"
                      )}
                    </button>
                  </form>

                  <div className="pt-2 text-center text-xs text-slate-400 space-y-2 select-none">
                    {authView === "login" ? (
                      <p>
                        ¿No tienes una cuenta?{" "}
                        <button
                          onClick={() => {
                            setAuthView("signup");
                            setAuthError("");
                            setAuthSuccess("");
                          }}
                          className="font-bold text-emerald-400 hover:text-emerald-300 ml-0.5 transition-colors cursor-pointer"
                        >
                          Regístrate aquí
                        </button>
                      </p>
                    ) : (
                      <p>
                        ¿Ya tienes cuenta?{" "}
                        <button
                          onClick={() => {
                            setAuthView("login");
                            setAuthError("");
                            setAuthSuccess("");
                          }}
                          className="font-bold text-emerald-400 hover:text-emerald-300 ml-0.5 transition-colors cursor-pointer"
                        >
                          Inicia Sesión
                        </button>
                      </p>
                    )}

                    {authView === "recover" && (
                      <p>
                        ¿Prefieres cambiarla?{" "}
                        <button
                          onClick={() => {
                            setAuthView("reset");
                            setAuthError("");
                            setAuthSuccess("");
                          }}
                          className="font-bold text-cyan-400 hover:text-cyan-300 ml-0.5 transition-colors cursor-pointer"
                        >
                          Restablecer Contraseña
                        </button>
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* TAB 1: MASTER CHAT (Brain Dump) */}
                  {activeTab === "chat" && (
                    <motion.div 
                      key="chat"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col h-full justify-between"
                  id="tab-view-chat"
                >
                  <div className="space-y-3.5 overflow-y-auto flex-1 pb-4 max-h-[580px] sm:max-h-[540px]">
                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-xs leading-relaxed text-slate-300">
                      <p className="font-bold text-white mb-1 flex items-center space-x-1">
                        <Info className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Brain Dump — ¿Cómo funciona?</span>
                      </p>
                      Escríbele o dictale notas de voz sobre lo que necesitas coordinar. La inteligencia extraerá las tareas, determinará prioridades y las enviará directamente a las APIs seguras de tus plataformas externas.
                    </div>

                    {db.chatHistory.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                      >
                        <div className={`p-3 rounded-2xl max-w-[85%] text-xs leading-relaxed shadow-md ${
                          msg.sender === "user" 
                            ? "bg-emerald-700 text-neutral-50 rounded-tr-none" 
                            : "bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none"
                        }`}>
                          <p>{msg.text}</p>
                          
                          {/* Rich attachment or audio indicator inside msg */}
                          {msg.mediaType === "audio" && (
                            <div className="mt-2 flex items-center space-x-1.5 p-1 bg-black/20 rounded text-[10px]">
                              <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
                              <span className="font-mono text-slate-300">Nota de voz procesada y transcrita</span>
                            </div>
                          )}

                          {msg.extractedTasksCount && msg.extractedTasksCount > 0 ? (
                            <div className="mt-2.5 p-2 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                              <span className="text-emerald-400 font-mono font-bold flex items-center space-x-1">
                                <Sparkles className="w-3 h-3" />
                                <span>+{msg.extractedTasksCount} Tareas Extraídas</span>
                              </span>
                              <button 
                                onClick={() => setActiveTab("itinerary")}
                                className="text-slate-400 hover:text-white underline text-[10px]"
                              >
                                Ver Itinerario
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1 px-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}

                    {sendingChat && (
                      <div className="flex flex-col items-start">
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-none text-xs flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-150"></span>
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-300"></span>
                          </div>
                          <span className="text-slate-400">Analizando brain dump con Inteligencia Artificial...</span>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Typing input / audio recorder bottom layout */}
                  <div className="pt-2 border-t border-slate-900/60 flex items-center space-x-1.5 bg-slate-950 shrink-0">
                    <button 
                      onClick={() => {
                        const filesPreset = [
                          "Contrato de Boda - Marcos.pdf",
                          "Plan de Marketing Junio.docx",
                          "Recibo de Luz Hogar.jpg"
                        ];
                        const randomFile = filesPreset[Math.floor(Math.random() * filesPreset.length)];
                        addLog(`📎 Adjuntando archivo: ${randomFile}`);
                        setChatInput((prev) => prev + ` [Contiene archivo: ${randomFile}] `);
                      }}
                      className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800"
                      title="Adjuntar archivo o imagen"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    
                    <div className="flex-1 relative flex items-center">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSendMessage();
                        }}
                        placeholder={voiceRecording ? "Grabando voz..." : "Escribe un Brain Dump o dictado..."} 
                        disabled={voiceRecording || sendingChat}
                        className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 rounded-xl pl-3 pr-8 py-2.5 border border-slate-800 focus:outline-none focus:border-emerald-500/80 text-xs disabled:opacity-50"
                      />
                      {voiceRecording && (
                        <div className="absolute right-3 flex items-center space-x-1">
                          <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                          <span className="text-[10px] font-mono text-rose-400 font-bold">{formatTimer(recordingTimer)}</span>
                        </div>
                      )}
                    </div>

                    {/* Microphone Activation Toggle */}
                    <button 
                      onClick={handleMicToggle}
                      className={`p-2.5 rounded-xl border transition-colors ${
                        voiceRecording 
                          ? "bg-rose-600 text-white border-rose-500 animate-pulse" 
                          : "bg-slate-900 text-slate-400 hover:text-emerald-400 border-slate-800 hover:bg-slate-800"
                      }`}
                      title={voiceRecording ? "Detener y procesar audio" : "Grabar dictado de voz"}
                    >
                      {voiceRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <button 
                      onClick={() => handleSendMessage()}
                      disabled={!chatInput.trim() || sendingChat}
                      className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: ITINERARY VIEW (Day-to-day timeline) */}
              {activeTab === "itinerary" && (
                <motion.div 
                  key="itinerary"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col h-full"
                  id="tab-view-itinerary"
                >
                  {/* Calendar Quick Toggle top row */}
                  <div className="flex bg-slate-900 p-1 rounded-xl space-x-1 mb-3">
                    <button 
                      onClick={() => setSelectedDate("2026-06-09")}
                      className={`flex-1 py-1 px-1 texts font-medium rounded-lg text-xs transition-colors ${
                        selectedDate === "2026-06-09" ? "bg-slate-800 text-white border border-slate-700/50" : "text-slate-400 hover:text-slate-100"
                      }`}
                    >
                      Hoy (9 Jun)
                    </button>
                    <button 
                      onClick={() => setSelectedDate("2026-06-10")}
                      className={`flex-1 py-1 px-1 font-medium rounded-lg text-xs transition-colors ${
                        selectedDate === "2026-06-10" ? "bg-slate-800 text-white border border-slate-700/50" : "text-slate-400 hover:text-slate-100"
                      }`}
                    >
                      Mañana (10 Jun)
                    </button>
                    <div className="flex-1 relative flex items-center justify-center p-1 bg-transparent text-xs text-slate-400 font-medium">
                      <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                      />
                      <span className="flex items-center space-x-1 hover:text-white pointer-events-none">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Filtro</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[520px]">
                    <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800">
                      <span>Día seleccionado: <b className="text-slate-100">{selectedDate}</b></span>
                      <span>{filteredTasks.length} Tareas</span>
                    </div>

                    {filteredTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <CheckSquare className="w-8 h-8 text-slate-700 mb-2" />
                        <p className="text-xs text-slate-400 font-medium">Día despejado de pendientes</p>
                        <p className="text-[10px] text-slate-500 mt-1">Usa la pestaña Asistente para volcar un Brain Dump</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredTasks.map((task) => {
                          const srcProps = sourceColors[task.source] || sourceColors.personal;
                          
                          return (
                            <motion.div 
                              key={task.id}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`p-3 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 transition-all shadow-sm flex items-start space-x-3 relative overflow-hidden`}
                            >
                              {/* Left category indicator line */}
                              <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${srcProps.accent}`} />
                              
                              <button 
                                onClick={() => handleToggleTask(task)}
                                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                  task.status === "completed" 
                                    ? "bg-emerald-600 border-emerald-500 text-white" 
                                    : "border-slate-700 hover:border-slate-500"
                                }`}
                              >
                                {task.status === "completed" && <Check className="w-3.5 h-3.5" />}
                              </button>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h3 className={`text-xs font-bold truncate ${task.status === "completed" ? "line-through text-slate-500" : "text-white"}`}>
                                    {task.title}
                                  </h3>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono leading-none tracking-wider uppercase ${
                                    task.priority === "high" ? "bg-rose-500/10 text-rose-300 border border-rose-500/20" :
                                    task.priority === "medium" ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" :
                                    "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                  }`}>
                                    {task.priority === "high" ? "ALTA" : task.priority === "medium" ? "MED" : "BAJA"}
                                  </span>
                                </div>

                                <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                                  {task.description}
                                </p>

                                <div className="mt-2.5 flex items-center justify-between text-[10px]">
                                  <span className={`px-2 py-0.5 rounded-full font-semibold uppercase flex items-center space-x-1 ${srcProps.text} ${srcProps.darkBg}`}>
                                    {task.source === "photography" ? <Camera className="w-2.5 h-2.5" /> :
                                     task.source === "classes" ? <BookOpen className="w-2.5 h-2.5" /> :
                                     task.source === "marketing" ? <Briefcase className="w-2.5 h-2.5" /> :
                                     <Home className="w-2.5 h-2.5" />}
                                    <span className="text-[9px] font-mono tracking-wider">{task.source}</span>
                                  </span>

                                  <div className="flex items-center space-x-2">
                                    {/* Delay simulator trigger (only if today and pending) */}
                                    {task.status === "pending" && (
                                      <button 
                                        onClick={() => simulateTaskDelay(task)}
                                        className="text-amber-500 hover:text-amber-400 font-mono text-[9px] border border-amber-500/20 px-1 py-0.5 rounded hover:bg-amber-500/5 uppercase"
                                        title="Simular alerta de retraso"
                                      >
                                        Demorar Tarea ⚠️
                                      </button>
                                    )}

                                    <button 
                                      onClick={() => handleDeleteTask(task.id, task.title)}
                                      className="text-slate-500 hover:text-rose-400 p-0.5"
                                      title="Borrar tarea"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Manual Task insertion overlay */}
                  <div className="mt-3 pt-3 border-t border-slate-900 bg-slate-950 flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Nueva tarea rápida..." 
                      id="quick-task-title-input"
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          const inputVal = (e.target as HTMLInputElement).value;
                          if (!inputVal.trim()) return;
                          
                          try {
                            const res = await fetch("/api/tasks", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                title: inputVal,
                                date: selectedDate,
                                source: "personal",
                                priority: "medium",
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setDb((prev) => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  tasks: [...prev.tasks, data.task],
                                };
                              });
                              addLog(`➕ Tarea rápida agregada: '${inputVal}'`);
                              (e.target as HTMLInputElement).value = "";
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                      className="flex-1 bg-slate-900 border border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <button 
                      onClick={() => {
                        const input = document.getElementById("quick-task-title-input") as HTMLInputElement;
                        if (input && input.value.trim()) {
                          const clickEvent = new KeyboardEvent("keydown", { key: "Enter" });
                          input.dispatchEvent(clickEvent);
                        }
                      }}
                      className="p-2 bg-slate-900 border border-slate-800 text-xs rounded-xl font-bold hover:bg-slate-800"
                    >
                      Añadir
                    </button>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: GLOBAL CALENDAR VIEW (Macro Perspective) */}
              {activeTab === "calendar" && (
                <motion.div 
                  key="calendar"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col h-full"
                  id="tab-view-calendar"
                >
                  <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-center mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-slate-100 font-mono tracking-wider">CALENDARIO MACRO — JUNI 2026</h3>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">Vista de Semana</span>
                    </div>

                    {/* Week representation grid */}
                    <div className="grid grid-cols-4 gap-2">
                      {juneDays.map((day) => {
                        // Count list of tasks for date
                        const dayTasks = db.tasks.filter((t) => t.date === day.date);
                        const isSelected = selectedDate === day.date;
                        const hasPhotography = dayTasks.some((t) => t.source === "photography");
                        const hasClasses = dayTasks.some((t) => t.source === "classes");
                        const hasMarketing = dayTasks.some((t) => t.source === "marketing");
                        const hasPersonal = dayTasks.some((t) => t.source === "personal");

                        return (
                          <button
                            key={day.date}
                            onClick={() => setSelectedDate(day.date)}
                            className={`p-2.5 rounded-xl border flex flex-col items-center justify-between transition-colors ${
                              isSelected 
                                ? "bg-emerald-600/20 border-emerald-500 text-white" 
                                : "bg-slate-950 border-slate-800/80 hover:bg-slate-800/60 text-slate-300"
                            }`}
                          >
                            <span className="text-[9px] font-mono font-medium text-slate-400">{day.dayStr}</span>
                            <span className="text-sm font-extrabold focus:outline-none">{day.dayNum}</span>
                            
                            {/* Source dots indicator panel */}
                            <div className="flex space-x-1.5 mt-1.5 h-1 items-center justify-center">
                              {hasPhotography && <span className="w-1 h-1 rounded-full bg-blue-400" />}
                              {hasClasses && <span className="w-1 h-1 rounded-full bg-orange-400" />}
                              {hasMarketing && <span className="w-1 h-1 rounded-full bg-purple-400" />}
                              {hasPersonal && <span className="w-1 h-1 rounded-full bg-emerald-400" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PANIC REARRANGE ALGORITHM BOARD CONTAINER */}
                  <div className="bg-[#1e131d] border border-rose-950/80 rounded-2xl p-4 flex flex-col space-y-3 shadow-xl">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg animate-pulse shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-rose-300">🚨 ¿El Día de Hoy es un Caos? (Panic Button)</h4>
                        <p className="text-[11px] text-slate-400 leading-normal mt-1">
                          Al presionar el Botón de Pánico, tu Secretaria AI analizará las tareas no urgentes asignadas para hoy (<b>{selectedDate}</b>), y las redistribuirá automáticamente a lo largo de los días restantes de la semana.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={triggerPanicButton}
                      disabled={panicking}
                      className="w-full py-2.5 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 tracking-wider uppercase"
                    >
                      {panicking ? "Reorganizando Agenda..." : "⚡ Activar Reprogramación de Asistente AI"}
                    </button>
                  </div>

                  {/* Quick summary below */}
                  <div className="mt-4 flex-1 overflow-y-auto space-y-2 max-h-[140px] text-xs">
                    <p className="text-[10px] uppercase font-mono font-bold text-slate-500 pb-1 border-b border-slate-800">
                      Tareas en foco ({selectedDate}):
                    </p>
                    {filteredTasks.length === 0 ? (
                      <p className="text-slate-500 text-[11px]">Niguna tarea programada para este día.</p>
                    ) : (
                      <div className="space-y-1">
                        {filteredTasks.map((t) => (
                          <div key={t.id} className="flex items-center justify-between text-[11px] bg-slate-900 p-1.5 rounded pr-2">
                            <span className="truncate text-slate-200">· {t.title}</span>
                            <span className="text-[9px] font-mono text-slate-400 uppercase">{t.source}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 4: PROFILE & INNER SETTINGS / INTEGRATIONS */}
              {activeTab === "settings" && (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col h-full pr-1 max-h-[580px] w-full"
                  id="tab-view-settings"
                >
                  <AnimatePresence mode="wait">
                    {/* SUB-VIEW 1: PROFILE MAIN */}
                    {profileSubView === "main" && (
                      <motion.div
                        key="profile-main"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                      >
                        {/* Profile Header Card */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 text-center relative overflow-hidden shadow-lg">
                          <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-emerald-400 bg-emerald-400/10 rounded-bl-xl border-l border-b border-emerald-500/20 select-none">
                            PRO
                          </div>
                          <div className="w-16 h-16 rounded-full bg-emerald-600 border border-emerald-500/10 flex items-center justify-center text-white font-extrabold text-xl mx-auto shadow-md select-none">
                            {currentUser?.email === 'gilbersonhernandezfotografia@gmail.com' ? "GH" : (currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : "U")}
                          </div>
                          <h3 className="text-sm font-bold text-white mt-3">
                            {currentUser?.email === 'gilbersonhernandezfotografia@gmail.com' ? "Gilberson Hernández" : currentUser?.email.split('@')[0]}
                          </h3>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {currentUser?.email || "gilbersonhernandezfotografia@gmail.com"}
                          </p>
                          
                          <div className="mt-4 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-center select-none">
                            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/40">
                              <span className="text-[10px] block text-slate-400 uppercase font-mono">Rol</span>
                              <span className="text-xs font-bold text-emerald-400">Director</span>
                            </div>
                            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800/40">
                              <span className="text-[10px] block text-slate-400 uppercase font-mono">Plan PWA</span>
                              <span className="text-xs font-bold text-cyan-400">Pro</span>
                            </div>
                          </div>
                        </div>

                        {/* Servicios Vinculados Section */}
                        <div className="bg-slate-900/60 border border-slate-800/85 rounded-2xl p-3.5 space-y-2.5 shadow-md">
                          <p className="text-[10px] uppercase font-mono font-bold tracking-widest text-slate-400 border-b border-slate-800/60 pb-1.5 flex items-center space-x-1.5">
                            <Database className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Servicios Vinculados (Supabase)</span>
                          </p>
                          <div className="grid grid-cols-1 gap-1.5 text-xs">
                            <div className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800/35 animate-fade-in">
                              <span className="flex items-center space-x-2 font-medium text-slate-300">
                                <Camera className="w-3.5 h-3.5 text-blue-400" />
                                <span>Estudio de Fotos</span>
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${db.externalApis.photography.status === "connected" ? "bg-blue-500/10 text-blue-300 border border-blue-500/15" : "bg-red-500/10 text-red-300 border border-red-500/15"}`}>
                                {db.externalApis.photography.status === "connected" ? "ACTIVO" : "OFF"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800/35">
                              <span className="flex items-center space-x-2 font-medium text-slate-300">
                                <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                                <span>Agencia de Mkt</span>
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${db.externalApis.marketing.status === "connected" ? "bg-purple-500/10 text-purple-300 border border-purple-500/15" : "bg-red-500/10 text-red-300 border border-red-500/15"}`}>
                                {db.externalApis.marketing.status === "connected" ? "ACTIVO" : "OFF"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800/35">
                              <span className="flex items-center space-x-2 font-medium text-slate-300">
                                <Home className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Gestión Hogar</span>
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${db.externalApis.personal.status === "connected" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/15" : "bg-red-500/10 text-red-300 border border-red-500/15"}`}>
                                {db.externalApis.personal.status === "connected" ? "ACTIVO" : "OFF"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-slate-950/60 rounded-xl border border-slate-800/35">
                              <span className="flex items-center space-x-2 font-medium text-slate-300">
                                <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                                <span>Clases y Docencia</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-orange-500/10 text-orange-300 border border-orange-500/15">
                                LOCAL
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* List of Menu Options */}
                        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-md">
                          <button
                            onClick={() => {
                              setProfileSubView("config");
                              addLog("⚙️ Abriendo: Menú de Configuraciones");
                            }}
                            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/35 transition-colors border-b border-slate-800 text-left"
                          >
                            <span className="flex items-center space-x-3 text-xs font-semibold text-slate-200">
                              <Settings className="w-4 h-4 text-emerald-400" />
                              <span>Configuraciones</span>
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          </button>
                          
                          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center space-x-3">
                              <Smartphone className="w-4 h-4 text-blue-400" />
                              <span>Estado PWA</span>
                            </span>
                            <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">ACTIVO</span>
                          </div>

                          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center space-x-3">
                              <Clock className="w-4 h-4 text-purple-400" />
                              <span>Estudio local</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-300">GMT-5</span>
                          </div>

                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-between p-3.5 hover:bg-rose-950/20 hover:text-rose-400 transition-colors text-left"
                          >
                            <span className="flex items-center space-x-3 text-xs font-semibold text-rose-400">
                              <LogOut className="w-4 h-4" />
                              <span>Cerrar Sesión</span>
                            </span>
                          </button>
                        </div>

                        <div className="p-3.5 bg-slate-900/20 border border-slate-800/40 rounded-xl text-[10.5px] text-slate-400 text-center leading-relaxed flex flex-col items-center space-y-2">
                          <div>
                            <p>Versión del Asistente <b className="font-mono text-emerald-400">v1.2.6</b></p>
                            <p className="mt-0.5 text-slate-500">Sincronizado con Supabase Postgres y Gemini API</p>
                          </div>
                          <button 
                            onClick={handleResetDemo}
                            className="text-[10px] flex items-center space-x-1.5 font-mono text-rose-400 hover:text-rose-300 border border-rose-500/20 bg-rose-500/5 px-2.5 py-1 rounded-xl transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
                            <span>Reiniciar Base de Datos</span>
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* SUB-VIEW 2: CONFIGURATION MENU */}
                    {profileSubView === "config" && (
                      <motion.div
                        key="profile-config"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-4"
                      >
                        {/* Navigation back and header */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <button 
                            onClick={() => setProfileSubView("main")}
                            className="flex items-center space-x-1 text-slate-400 hover:text-white text-xs font-medium"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Perfil</span>
                          </button>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Configuración</h4>
                          <div className="w-12"></div> {/* Spacer balance */}
                        </div>

                        {/* Config list of items */}
                        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-md">
                          <button
                            onClick={() => {
                              setProfileSubView("integrations");
                              addLog("🔌 Abriendo: Menú de Integraciones y APIs");
                            }}
                            className="w-full flex items-center justify-between p-3.5 hover:bg-slate-800/35 transition-colors border-b border-slate-800 text-left"
                          >
                            <span className="flex items-center space-x-3 text-xs font-semibold text-slate-200">
                              <Key className="w-4 h-4 text-emerald-400" />
                              <span>Integraciones</span>
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          </button>
                          
                          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center space-x-3">
                              <Bell className="w-4 h-4 text-amber-400" />
                              <span>Notificaciones Push</span>
                            </span>
                            <span className="text-xs text-slate-300 font-medium font-mono">ACTIVO</span>
                          </div>

                          <div className="p-3.5 flex items-center justify-between text-xs text-slate-400">
                            <span className="flex items-center space-x-3">
                              <Lock className="w-4 h-4 text-cyan-400" />
                              <span>Seguridad de Supabase</span>
                            </span>
                            <span className="text-xs text-emerald-400 font-bold font-mono">SSL ON</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* SUB-VIEW 3: INTEGRATIONS / APIS */}
                    {profileSubView === "integrations" && (
                      <motion.div
                        key="profile-integrations"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-3 overflow-y-auto max-h-[500px] pr-1"
                      >
                        {/* Navigation back and header */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <button 
                            onClick={() => setProfileSubView("config")}
                            className="flex items-center space-x-1 text-slate-400 hover:text-white text-xs font-medium"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Atrás</span>
                          </button>
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono text-center">Integraciones (APIs)</h4>
                          <div className="w-12"></div> {/* Spacer balance */}
                        </div>

                        {/* APIs Theme / Credentials List */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                          <div className="flex items-center space-x-1.5 pb-2 border-b border-slate-800">
                            <Key className="text-emerald-400 w-4 h-4" />
                            <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">Credenciales de APIs Externas</h4>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-normal">
                            Las llaves se guardan y procesan de forma 100% segura en <b>Supabase Edge Functions</b> para evitar fugas al navegador del cliente.
                          </p>

                          {/* App 1: Photography */}
                          <div className="space-y-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-blue-300 flex items-center space-x-1">
                                <Camera className="w-3.5 h-3.5" />
                                <span>Photography Studio API</span>
                              </span>
                              <select 
                                value={db.externalApis.photography.status}
                                onChange={(e) => handleUpdateApiSettings("photography", e.target.value as "connected" | "disconnected", db.externalApis.photography.key, db.externalApis.photography.endpoint)}
                                className="bg-slate-900 text-[10px] text-slate-300 border border-slate-800 rounded p-1 focus:outline-none"
                              >
                                <option value="connected">Conectado</option>
                                <option value="disconnected">Desconectado</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-1 gap-1 text-[11px]">
                              <div className="flex items-center justify-between text-slate-400 border-b border-slate-900/40 pb-1">
                                <span>Endpoint:</span>
                                <span className="font-mono text-[10px] text-slate-300">{db.externalApis.photography.endpoint}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-400">
                                <span>API Secret Key:</span>
                                <span className="font-mono text-[10px] text-slate-300">••••••••••••••••••••••••</span>
                              </div>
                            </div>
                          </div>

                          {/* App 2: Marketing */}
                          <div className="space-y-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-purple-300 flex items-center space-x-1">
                                <Briefcase className="w-3.5 h-3.5" />
                                <span>Marketing Agency API</span>
                              </span>
                              <select 
                                value={db.externalApis.marketing.status}
                                onChange={(e) => handleUpdateApiSettings("marketing", e.target.value as "connected" | "disconnected", db.externalApis.marketing.key, db.externalApis.marketing.endpoint)}
                                className="bg-slate-900 text-[10px] text-slate-300 border border-slate-800 rounded p-1 focus:outline-none"
                              >
                                <option value="connected">Conectado</option>
                                <option value="disconnected">Desconectado</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-1 gap-1 text-[11px]">
                              <div className="flex items-center justify-between text-slate-400 border-b border-slate-900/40 pb-1">
                                <span>Endpoint:</span>
                                <span className="font-mono text-[10px] text-slate-300">{db.externalApis.marketing.endpoint}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-400">
                                <span>API Secret Key:</span>
                                <span className="font-mono text-[10px] text-slate-300">••••••••••••••••••••••••</span>
                              </div>
                            </div>
                          </div>

                          {/* App 3: Personal */}
                          <div className="space-y-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-300 flex items-center space-x-1">
                                <Home className="w-3.5 h-3.5" />
                                <span>Personal / Home Portal</span>
                              </span>
                              <select 
                                value={db.externalApis.personal.status}
                                onChange={(e) => handleUpdateApiSettings("personal", e.target.value as "connected" | "disconnected", db.externalApis.personal.key, db.externalApis.personal.endpoint)}
                                className="bg-slate-900 text-[10px] text-slate-300 border border-slate-800 rounded p-1 focus:outline-none"
                              >
                                <option value="connected">Conectado</option>
                                <option value="disconnected">Desconectado</option>
                              </select>
                            </div>
                            <div className="grid grid-cols-1 gap-1 text-[11px]">
                              <div className="flex items-center justify-between text-slate-400 border-b border-slate-900/40 pb-1">
                                <span>Endpoint:</span>
                                <span className="font-mono text-[10px] text-slate-300">{db.externalApis.personal.endpoint}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-400">
                                <span>API Secret Key:</span>
                                <span className="font-mono text-[10px] text-slate-300">••••••••••••••••••••••••</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* WEB PUSH SERVICE WORKER INTERACTIVE MANUAL SETTINGS */}
                        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 flex flex-col space-y-3 shadow-md">
                          <div className="flex items-center space-x-2 pb-2 border-b border-slate-900">
                            <Bell className="text-emerald-400 w-4 h-4" />
                            <h4 className="text-xs font-bold text-slate-200">Guía: Notificaciones Push & Webhooks</h4>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-normal">
                            Aprende a integrar el <b>Service Worker</b> y disparadores automáticos en Supabase para enviar alertas flotantes a Android/iOS si una sesión expira o un photoshoot se aplaza.
                          </p>

                          <button 
                            onClick={() => setShowNotificationGuide(!showNotificationGuide)}
                            className="text-xs font-semibold py-2 bg-slate-900 hover:bg-slate-800 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 rounded-xl transition-colors"
                          >
                            {showNotificationGuide ? "Esconder Tutorial de Arquitectura" : "Ver Código del Service Worker"}
                          </button>

                          {showNotificationGuide && (
                            <div className="bg-slate-900 text-[10px] font-mono rounded-lg p-2.5 text-emerald-300 leading-relaxed overflow-x-auto space-y-2 border border-slate-800">
                              <div>
                                <p className="text-white font-bold mb-1">// 1. Service Worker registration (pwa.js)</p>
                                <pre className="text-slate-400">
{`navigator.serviceWorker.register('/sw.js')
.then(reg => {
  console.log('SW scope:', reg.scope);
});`}
                                </pre>
                              </div>
                              <div>
                                <p className="text-white font-bold mb-1">// 2. sw.js event listener</p>
                                <pre className="text-slate-400">
{`self.addEventListener('push', (e) => {
  const data = e.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/logo.png',
    vibrate: [200, 100, 200]
  });
});`}
                                </pre>
                              </div>
                              <div>
                                <p className="text-white font-bold mb-1">// 3. Supabase Edge Function Webhook</p>
                                <pre className="text-slate-400">
{`// Se activa con un trigger de PostgreSQL
// tras detectar retraso en las tareas:
fetch('https://fcm.googleapis.com/fcm', {
  method: 'POST',
  headers: { 'Authorization': 'key=...' },
  body: JSON.stringify({...})
})`}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
                </>
              )}
            </AnimatePresence>
          </div>

          {/* APPLICATION BOTTOM TAB NAV BAR */}
          {currentUser !== null && (
            <div className="bg-slate-900 border-t border-slate-800/80 px-2 py-2.5 flex items-center justify-around shrink-0 relative z-10 select-none">
              <button 
                onClick={() => {
                  setActiveTab("chat");
                  addLog("📂 Navegando a: Chat / Brain Dump");
                }}
                className={`flex flex-col items-center space-y-1 transition-all ${
                  activeTab === "chat" ? "text-emerald-400 scale-105" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <MessageSquare className="w-5 h-5 focus:outline-none" />
                <span className="text-[9px] font-bold tracking-tight">Voz / Chat</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("itinerary");
                  addLog("📂 Navegando a: Itinerario de Hoy");
                }}
                className={`flex flex-col items-center space-y-1 transition-all ${
                  activeTab === "itinerary" ? "text-emerald-400 scale-105" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <CheckSquare className="w-5 h-5 focus:outline-none" />
                <span className="text-[9px] font-bold tracking-tight">Itinerario</span>
              </button>

              <button 
                onClick={() => {
                  setActiveTab("calendar");
                  addLog("📂 Navegando a: Agenda Completa");
                }}
                className={`flex flex-col items-center space-y-1 transition-all ${
                  activeTab === "calendar" ? "text-emerald-400 scale-105" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Calendar className="w-5 h-5 focus:outline-none" />
                <span className="text-[9px] font-bold tracking-tight">Calendario</span>
              </button>

               <button 
                onClick={() => {
                  setActiveTab("settings");
                  setProfileSubView("main");
                  addLog("📂 Navegando al Perfil de Gilberson");
                }}
                className={`flex flex-col items-center space-y-1 transition-all ${
                  activeTab === "settings" ? "text-emerald-400 scale-105" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <User className="w-5 h-5 focus:outline-none" />
                <span className="text-[9px] font-bold tracking-tight">Perfil</span>
              </button>
            </div>
          )}

          {/* Smartphone bottom home indicator line */}
          <div className="hidden sm:block bg-slate-950 py-1.5 w-full flex items-center justify-center shrink-0">
            <div className="w-32 h-1 bg-slate-800 rounded-full"></div>
          </div>

        </div>
      </div>

    </div>
  );
}
