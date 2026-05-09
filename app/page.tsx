"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Peer from "peerjs";
import { v4 as uuid } from "uuid";

import {
  Copy,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Users,
  Settings,
  X,
  Check,
  Loader2,
  Signal,
  Wifi,
  WifiOff,
  MessageCircle,
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  ArrowLeft,
  PhoneCall,
  Video as VideoIcon,
  Volume2,
  VolumeX,
  Camera,
  Mic as MicIcon,
  Grid3x3,
  Minimize,
  Maximize,
} from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "local" | "remote";
  timestamp: Date;
  status: "sending" | "sent" | "delivered" | "read";
}

export default function Home() {
  // Video/Audio refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Peer connection refs
  const peerRef = useRef<Peer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentCallRef = useRef<any>(null);
  const dataConnectionRef = useRef<any>(null);

  // State variables
  const [peerId, setPeerId] = useState("");
  const [remoteId, setRemoteId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [callQuality, setCallQuality] = useState<
    "excellent" | "good" | "poor" | "unknown"
  >("unknown");

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [showVideoOnly, setShowVideoOnly] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [incomingCall, setIncomingCall] = useState<{
    from: string;
    call: any;
  } | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    initializePeer();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of messages
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Handle fullscreen changes
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Monitor call quality
  useEffect(() => {
    if (!isInCall) return;

    const interval = setInterval(() => {
      // Simulate quality check based on connection
      if (remoteVideoRef.current) {
        const videoElement = remoteVideoRef.current;
        if (videoElement.readyState < 2) {
          setCallQuality("poor");
        } else {
          setCallQuality(Math.random() > 0.3 ? "excellent" : "good");
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isInCall]);

  const initializePeer = async () => {
    const id = uuid().slice(0, 8);
    const peer = new Peer(id, {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("open", (id) => {
      setPeerId(id);
      setConnectionStatus("disconnected");
    });

    peer.on("call", async (call) => {
      setIncomingCall({
        from: call.peer,
        call: call,
      });
    });

    peer.on("connection", (conn) => {
      dataConnectionRef.current = conn;
      setupDataConnection(conn);
    });

    peer.on("error", (err) => {
      console.error("Peer error:", err);
      setConnectionStatus("disconnected");
      setIsConnecting(false);
    });

    peerRef.current = peer;
    await setupLocalVideo();
  };

  const setupDataConnection = (conn: any) => {
    conn.on("data", (data: any) => {
      if (data.type === "chat") {
        addMessage(data.text, "remote", data.status || "delivered");
      }
    });

    conn.on("open", () => {
      console.log("Data connection established");
    });
  };

  const getLocalStream = async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  };

  const setupLocalVideo = async () => {
    try {
      const stream = await getLocalStream();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Failed to setup local video:", error);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await getLocalStream();
      incomingCall.call.answer(stream);

      incomingCall.call.on("stream", (remoteStream: MediaStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      incomingCall.call.on("close", () => {
        endCall();
      });

      currentCallRef.current = incomingCall.call;
      setIsInCall(true);
      setConnectionStatus("connected");
      setIncomingCall(null);
      startCallTimer();
    } catch (error) {
      console.error("Failed to accept call:", error);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.call.close();
      setIncomingCall(null);
    }
  };

  const startCall = async () => {
    if (!remoteId.trim()) {
      alert("Please enter a Peer ID to connect");
      return;
    }

    setIsConnecting(true);
    setConnectionStatus("connecting");

    try {
      const stream = await getLocalStream();
      const call = peerRef.current?.call(remoteId, stream);

      if (!call) {
        throw new Error("Failed to create call");
      }

      // Setup data connection for chat
      const conn = peerRef.current?.connect(remoteId);
      if (conn) {
        dataConnectionRef.current = conn;
        setupDataConnection(conn);
      }

      call.on("stream", (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      call.on("close", () => {
        endCall();
      });

      call.on("error", (err) => {
        console.error("Call error:", err);
        endCall();
      });

      currentCallRef.current = call;
      setIsInCall(true);
      setConnectionStatus("connected");
      startCallTimer();
    } catch (error) {
      console.error("Failed to start call:", error);
      alert(
        "Could not connect. Please make sure the remote peer is available.",
      );
      setConnectionStatus("disconnected");
    } finally {
      setIsConnecting(false);
    }
  };

  const startCallTimer = () => {
    setCallDuration(0);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    durationIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const endCall = () => {
    if (currentCallRef.current) {
      currentCallRef.current.close();
      currentCallRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setIsInCall(false);
    setConnectionStatus("disconnected");
    setShowChat(false);

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
    setCallDuration(0);
  };

  const copyId = async () => {
    await navigator.clipboard.writeText(peerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()?.at(0);
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()?.at(0);
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setCameraEnabled(videoTrack.enabled);
  };

  const toggleSpeaker = () => {
    setSpeakerEnabled(!speakerEnabled);
    // Note: Speaker control would require additional WebRTC implementation
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const addMessage = (
    text: string,
    sender: "local" | "remote",
    status: Message["status"] = "sent",
  ) => {
    const newMessage: Message = {
      id: uuid(),
      text,
      sender,
      timestamp: new Date(),
      status: sender === "local" ? status : "delivered",
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;

    const messageText = messageInput.trim();
    addMessage(messageText, "local", "sending");

    if (dataConnectionRef.current && dataConnectionRef.current.open) {
      dataConnectionRef.current.send({
        type: "chat",
        text: messageText,
        status: "delivered",
      });
      // Update message status
      setMessages((prev) =>
        prev.map((msg) =>
          msg.text === messageText &&
          msg.sender === "local" &&
          msg.status === "sending"
            ? { ...msg, status: "sent" }
            : msg,
        ),
      );
    }

    setMessageInput("");
    chatInputRef.current?.focus();
  };

  const getQualityColor = () => {
    switch (callQuality) {
      case "excellent":
        return "text-green-500";
      case "good":
        return "text-yellow-500";
      case "poor":
        return "text-red-500";
      default:
        return "text-gray-400";
    }
  };

  const getQualityIcon = () => {
    switch (callQuality) {
      case "excellent":
        return <Wifi className="w-4 h-4" />;
      case "good":
        return <Signal className="w-4 h-4" />;
      case "poor":
        return <WifiOff className="w-4 h-4" />;
      default:
        return <Signal className="w-4 h-4" />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"
    >
      {/* Incoming Call Modal - WhatsApp Style */}
      {incomingCall && !isMinimized && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-500">
          <div className="text-center w-full max-w-sm mx-4">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center animate-pulse">
              <PhoneCall className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Incoming Call
            </h3>
            <p className="text-gray-400 mb-2 font-mono text-sm">
              {incomingCall.from}
            </p>
            <p className="text-gray-500 text-sm mb-8">WhatsApp Video Call</p>
            <div className="flex gap-6 justify-center">
              <button
                onClick={rejectCall}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-300 flex items-center justify-center shadow-lg"
              >
                <PhoneOff className="w-8 h-8 text-white" />
              </button>
              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 transition-all duration-300 flex items-center justify-center shadow-lg"
              >
                <Phone className="w-8 h-8 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="relative h-screen flex flex-col">
        {/* Header - WhatsApp Style */}
        <div className="bg-gray-900/95 backdrop-blur-md border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {isInCall && showChat && (
              <button onClick={() => setShowChat(false)} className="md:hidden">
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
              <VideoIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">GlideCall</h1>
              {isInCall && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-green-500">● Live</span>
                  <span className="text-gray-400">
                    {formatDuration(callDuration)}
                  </span>
                  <span
                    className={`flex items-center gap-1 ${getQualityColor()}`}
                  >
                    {getQualityIcon()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isInCall && (
              <>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="p-2 rounded-full hover:bg-white/10 transition-all"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowVideoOnly(!showVideoOnly)}
                  className="p-2 rounded-full hover:bg-white/10 transition-all hidden md:flex"
                >
                  {showVideoOnly ? (
                    <Grid3x3 className="w-5 h-5" />
                  ) : (
                    <Maximize className="w-5 h-5" />
                  )}
                </button>
              </>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-full hover:bg-white/10 transition-all"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content - Video and Chat */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video Container */}
          <div
            className={`flex-1 ${showChat && isInCall ? "hidden md:flex" : "flex"} flex-col bg-black`}
          >
            {/* Remote Video (Primary) */}
            <div className="flex-1 relative bg-gray-900">
              <div className="flex justify-center mt-5 max-h-[100px]">
                <div className="bg-gray-800/50 rounded-2xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Your ID</p>
                  <code className="text-green-400 font-mono text-sm break-all">
                    {peerId || "Loading..."}
                  </code>
                  <button
                    onClick={copyId}
                    className="mt-2 text-xs text-green-500 hover:text-green-400 flex items-center gap-1 mx-auto"
                  >
                    {copied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copied ? "Copied" : "Copy ID"}
                  </button>
                </div>
              </div>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Remote Video Placeholder */}
              {/* {(!remoteVideoRef.current?.srcObject || !isInCall) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-4 bg-gray-700 rounded-full flex items-center justify-center">
                      <Users className="w-12 h-12 text-gray-500" />
                    </div>
               
                    {!isInCall && (
                      <div className="mt-6 px-4">
                        <div className="bg-gray-800/50 rounded-2xl p-4">
                          <p className="text-xs text-gray-500 mb-2">Your ID</p>
                          <code className="text-green-400 font-mono text-sm break-all">
                            {peerId || "Loading..."}
                          </code>
                          <button
                            onClick={copyId}
                            className="mt-2 text-xs text-green-500 hover:text-green-400 flex items-center gap-1 mx-auto"
                          >
                            {copied ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copied ? "Copied" : "Copy ID"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )} */}

              {/* Controls Overlay */}
              {isInCall && (
                <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-3">
                  <button
                    onClick={toggleMic}
                    className={`p-3 rounded-full transition-all ${
                      micEnabled ? "bg-gray-700/90" : "bg-red-500/90"
                    } hover:scale-110 transition-transform`}
                  >
                    {micEnabled ? (
                      <Mic className="w-5 h-5" />
                    ) : (
                      <MicOff className="w-5 h-5" />
                    )}
                  </button>

                  <button
                    onClick={endCall}
                    className="p-3 rounded-full bg-red-500 hover:bg-red-600 hover:scale-110 transition-all"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>

                  <button
                    onClick={toggleCamera}
                    className={`p-3 rounded-full transition-all ${
                      cameraEnabled ? "bg-gray-700/90" : "bg-red-500/90"
                    } hover:scale-110 transition-transform`}
                  >
                    {cameraEnabled ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <VideoOff className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}

              {/* Local Video Picture-in-Picture */}
              {isInCall && !showVideoOnly && (
                <div className="absolute top-4 right-4 w-32 md:w-40 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-1">
                    {!micEnabled && <MicOff className="w-3 h-3 text-red-400" />}
                    {!cameraEnabled && (
                      <VideoOff className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Local Video Full View (when not in call) */}
            {!isInCall && (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                <div className="w-full max-w-2xl mx-auto p-4">
                  <div className="relative bg-gray-800 rounded-3xl overflow-hidden aspect-video">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs">
                      Preview
                    </div>
                  </div>

                  {/* Connection UI */}
                  <div className="mt-6 space-y-4">
                    <div className="bg-gray-800/50 rounded-2xl p-4">
                      <input
                        value={remoteId}
                        onChange={(e) => setRemoteId(e.target.value)}
                        placeholder="Enter Peer ID to connect"
                        className="w-full bg-gray-900 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-green-500"
                        onKeyPress={(e) => e.key === "Enter" && startCall()}
                      />
                      <button
                        onClick={startCall}
                        disabled={isConnecting || !remoteId.trim()}
                        className="w-full mt-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-3 font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Phone className="w-5 h-5" />
                        )}
                        Start Call
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Sidebar - WhatsApp Style */}
          {isInCall && showChat && (
            <div className="w-full md:w-96 bg-gray-900/95 backdrop-blur-md border-l border-gray-800 flex flex-col animate-in slide-in-right duration-300">
              <div className="p-4 border-b border-gray-800">
                <h3 className="font-semibold text-white">Chat</h3>
                <p className="text-xs text-gray-500">End-to-end encrypted</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-gray-500 text-sm mt-10">
                    No messages yet
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "local" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.sender === "local"
                          ? "bg-green-500 text-white"
                          : "bg-gray-800 text-gray-100"
                      }`}
                    >
                      <p className="text-sm break-words">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] opacity-70">
                          {msg.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {msg.sender === "local" && (
                          <span className="text-[10px]">
                            {msg.status === "sending" && "..."}
                            {msg.status === "sent" && "✓"}
                            {msg.status === "delivered" && "✓✓"}
                            {msg.status === "read" && "✓✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-full hover:bg-gray-800 transition-all">
                    <Smile className="w-5 h-5 text-gray-400" />
                  </button>
                  <input
                    ref={chatInputRef}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type a message"
                    className="flex-1 bg-gray-800 rounded-full px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim()}
                    className="p-2 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-gray-900 rounded-3xl p-6 max-w-md w-full mx-4 border border-gray-800 shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-800/50 rounded-2xl">
                <p className="text-sm text-gray-400 mb-2">Your Peer ID</p>
                <code className="text-green-400 font-mono break-all text-sm">
                  {peerId}
                </code>
                <button
                  onClick={copyId}
                  className="mt-2 text-xs text-green-500 hover:text-green-400 flex items-center gap-1"
                >
                  {copied ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  {copied ? "Copied" : "Copy ID"}
                </button>
              </div>

              <div className="p-4 bg-gray-800/50 rounded-2xl">
                <p className="text-sm text-gray-400 mb-2">Call Settings</p>
                <div className="space-y-2">
                  <button
                    onClick={toggleSpeaker}
                    className="w-full text-left text-sm flex items-center justify-between"
                  >
                    <span>Speaker</span>
                    <span
                      className={
                        speakerEnabled ? "text-green-500" : "text-gray-500"
                      }
                    >
                      {speakerEnabled ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-800/50 rounded-2xl">
                <p className="text-sm text-gray-400 mb-2">About</p>
                <p className="text-xs text-gray-500">
                  Secure P2P Video Calling • End-to-end encrypted
                </p>
                <p className="text-xs text-gray-600 mt-1">Version 2.0.0</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes zoom-in-95 {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-in {
          animation-duration: 0.3s;
          animation-fill-mode: both;
        }
        .fade-in {
          animation-name: fade-in;
        }
        .zoom-in-95 {
          animation-name: zoom-in-95;
        }
        .slide-in-right {
          animation-name: slide-in-right;
        }
      `}</style>
    </div>
  );
}
