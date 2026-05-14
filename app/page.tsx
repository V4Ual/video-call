"use client";

import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import { v4 as uuid } from "uuid";

import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Copy,
  Check,
  Send,
  MessageCircle,
  X,
} from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "local" | "remote";
}

export default function Home() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const peerRef = useRef<Peer | null>(null);
  const currentCallRef = useRef<any>(null);
  const dataConnectionRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [peerId, setPeerId] = useState("");
  const [remoteId, setRemoteId] = useState("");

  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const [incomingCall, setIncomingCall] = useState<any>(null);

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const [copied, setCopied] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");

  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    initializePeer();

    return () => {
      cleanup();
    };
  }, []);

  const initializePeer = async () => {
    try {
      const id = uuid().slice(0, 8);

      const peer = new Peer(id, {
        debug: 2,

        config: {
          iceServers: [
            {
              urls: "stun:stun.l.google.com:19302",
            },
            {
              urls: "stun:stun1.l.google.com:19302",
            },
            {
              urls: "turn:openrelay.metered.ca:80",
              username: "openrelayproject",
              credential: "openrelayproject",
            },
            {
              urls: "turn:openrelay.metered.ca:443",
              username: "openrelayproject",
              credential: "openrelayproject",
            },
          ],
        },
      });

      peer.on("open", (id) => {
        setPeerId(id);
      });

      peer.on("call", (call) => {
        setIncomingCall(call);
      });

      peer.on("connection", (conn) => {
        conn.on("open", () => {
          dataConnectionRef.current = conn;

          setupDataConnection(conn);
        });
      });

      peerRef.current = peer;

      await setupLocalVideo();
    } catch (err) {
      console.error(err);
    }
  };

  const getLocalStream = async () => {
    try {
      if (localStreamRef.current) {
        return localStreamRef.current;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;

      return stream;
    } catch (error) {
      console.error(error);

      alert("Camera / microphone permission denied");

      throw error;
    }
  };

  const setupLocalVideo = async () => {
    try {
      const stream = await getLocalStream();

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;

        await localVideoRef.current.play();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const setupCallHandlers = (call: any) => {
    call.on("stream", async (remoteStream: MediaStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;

        try {
          await remoteVideoRef.current.play();
        } catch (err) {
          console.error(err);
        }
      }
    });

    call.on("close", () => {
      endCall();
    });

    call.on("error", () => {
      endCall();
    });
  };

  const startCall = async () => {
    if (!remoteId.trim()) {
      alert("Enter Remote Peer ID");

      return;
    }

    try {
      setIsConnecting(true);

      const stream = await getLocalStream();

      const conn = peerRef.current?.connect(remoteId, {
        reliable: true,
      });

      if (conn) {
        conn.on("open", () => {
          dataConnectionRef.current = conn;

          setupDataConnection(conn);
        });
      }

      const call = peerRef.current?.call(remoteId, stream);

      if (!call) {
        throw new Error("Call failed");
      }

      currentCallRef.current = call;

      setupCallHandlers(call);

      setIsInCall(true);
    } catch (err) {
      console.error(err);

      alert("Connection Failed");
    } finally {
      setIsConnecting(false);
    }
  };

  const acceptCall = async () => {
    try {
      const stream = await getLocalStream();

      incomingCall.answer(stream);

      currentCallRef.current = incomingCall;

      setupCallHandlers(incomingCall);

      setIncomingCall(null);

      setIsInCall(true);
    } catch (err) {
      console.error(err);
    }
  };

  const rejectCall = () => {
    incomingCall.close();

    setIncomingCall(null);
  };

  const endCall = () => {
    try {
      if (currentCallRef.current) {
        currentCallRef.current.close();
        currentCallRef.current = null;
      }

      if (dataConnectionRef.current) {
        dataConnectionRef.current.close();
        dataConnectionRef.current = null;
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      setIsInCall(false);
    } catch (err) {
      console.error(err);
    }
  };

  const setupDataConnection = (conn: any) => {
    conn.on("data", (data: any) => {
      if (data.type === "chat") {
        addMessage(data.text, "remote");
      }
    });

    conn.on("error", console.error);
  };

  const addMessage = (text: string, sender: "local" | "remote") => {
    setMessages((prev) => [
      ...prev,
      {
        id: uuid(),
        text,
        sender,
      },
    ]);
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;

    addMessage(messageInput, "local");

    if (dataConnectionRef.current?.open) {
      dataConnectionRef.current.send({
        type: "chat",
        text: messageInput,
      });
    }

    setMessageInput("");
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()?.at(0);

    if (!track) return;

    track.enabled = !track.enabled;

    setMicEnabled(track.enabled);
  };

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()?.at(0);

    if (!track) return;

    track.enabled = !track.enabled;

    setCameraEnabled(track.enabled);
  };

  const copyId = async () => {
    await navigator.clipboard.writeText(peerId);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const cleanup = () => {
    try {
      endCall();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (peerRef.current) {
        peerRef.current.destroy();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-screen w-full bg-[#0b141a] text-white overflow-hidden relative">
      {/* REMOTE VIDEO */}

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover bg-black"
      />

      {/* OVERLAY */}

      <div className="absolute inset-0 bg-black/30" />

      {/* TOP BAR */}

      <div className="absolute top-0 left-0 right-0 z-30 h-16 bg-gradient-to-b from-black/70 to-transparent px-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-lg">GlideCall</h1>

          <p className="text-xs text-gray-300">
            {isInCall ? "Connected" : "Secure Video Call"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyId}
            className="w-11 h-11 rounded-full bg-[#202c33]/90 backdrop-blur-xl flex items-center justify-center border border-[#2a3942]"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className="w-11 h-11 rounded-full bg-[#202c33]/90 backdrop-blur-xl flex items-center justify-center border border-[#2a3942]"
          >
            {showChat ? (
              <X className="w-5 h-5" />
            ) : (
              <MessageCircle className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* WAITING */}

      {!isInCall && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="w-28 h-28 rounded-full bg-[#202c33] flex items-center justify-center mb-6">
            <Phone className="w-12 h-12 text-green-400" />
          </div>

          <h2 className="text-3xl font-semibold mb-2">Waiting for Call</h2>

          <p className="text-gray-300 mb-6 text-center px-5">
            Share your peer ID to start secure call
          </p>

          <div className="bg-[#202c33]/90 backdrop-blur-xl border border-[#2a3942] rounded-2xl p-4 w-[90%] max-w-md">
            <p className="text-xs text-gray-400 mb-2">YOUR PEER ID</p>

            <div className="text-green-400 font-mono break-all">
              {peerId || "Generating..."}
            </div>

            <div className="flex gap-2 mt-4">
              <input
                value={remoteId}
                onChange={(e) => setRemoteId(e.target.value)}
                placeholder="Enter Remote Peer ID"
                className="flex-1 bg-[#111b21] rounded-xl px-4 py-3 outline-none"
              />

              <button
                onClick={startCall}
                disabled={isConnecting}
                className="w-14 rounded-xl bg-green-500 hover:bg-green-600 flex items-center justify-center"
              >
                {isConnecting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Phone className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCAL VIDEO */}

      <div className="absolute top-20 right-4 z-20 w-32 h-48 md:w-60 md:h-40 rounded-2xl overflow-hidden border border-[#2a3942] shadow-2xl bg-black">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
      </div>

      {/* CHAT PANEL */}

      <div
        className={`absolute top-0 right-0 h-full w-full md:w-[380px] bg-[#202c33]/95 backdrop-blur-2xl border-l border-[#2a3942] z-40 flex flex-col transition-all duration-300 ${
          showChat ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* HEADER */}

        <div className="h-16 px-4 border-b border-[#2a3942] flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Messages</h2>

            <p className="text-xs text-gray-400">Secure Chat</p>
          </div>

          <button
            onClick={() => setShowChat(false)}
            className="w-10 h-10 rounded-full hover:bg-[#2a3942] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CHAT */}

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              No messages yet
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "local" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  msg.sender === "local" ? "bg-[#005c4b]" : "bg-[#111b21]"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* INPUT */}

        <div className="p-3 border-t border-[#2a3942]">
          <div className="flex gap-2">
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Type message..."
              className="flex-1 bg-[#111b21] rounded-full px-5 py-3 outline-none"
            />

            <button
              onClick={sendMessage}
              className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* CONTROLS */}

      {isInCall && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-[#202c33]/95 backdrop-blur-xl border border-[#2a3942] rounded-full px-6 py-4 flex items-center gap-5 shadow-2xl">
            <button
              onClick={toggleMic}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                micEnabled ? "bg-[#2a3942]" : "bg-red-500"
              }`}
            >
              {micEnabled ? <Mic /> : <MicOff />}
            </button>

            <button
              onClick={endCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
            >
              <PhoneOff />
            </button>

            <button
              onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                cameraEnabled ? "bg-[#2a3942]" : "bg-red-500"
              }`}
            >
              {cameraEnabled ? <Video /> : <VideoOff />}
            </button>
          </div>
        </div>
      )}

      {/* INCOMING CALL */}

      {incomingCall && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#202c33] p-8 rounded-3xl text-center w-[90%] max-w-sm border border-[#2a3942]">
            <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-5 animate-pulse">
              <Phone className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>

            <p className="text-gray-400 text-sm break-all mb-8">
              {incomingCall.peer}
            </p>

            <div className="flex justify-center gap-5">
              <button
                onClick={rejectCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center"
              >
                <PhoneOff />
              </button>

              <button
                onClick={acceptCall}
                className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"
              >
                <Phone />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
