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

  useEffect(() => {
    initializePeer();

    return () => {
      cleanup();
    };
  }, []);

  // ===============================
  // INITIALIZE PEER
  // ===============================

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

            // TURN SERVERS
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
        console.log("✅ Peer Open:", id);

        setPeerId(id);
      });

      peer.on("call", (call) => {
        console.log("📞 Incoming Call");

        setIncomingCall(call);
      });

      peer.on("connection", (conn) => {
        console.log("📨 Incoming Data Connection");

        conn.on("open", () => {
          console.log("✅ Data Channel Open");

          dataConnectionRef.current = conn;

          setupDataConnection(conn);
        });
      });

      peer.on("error", (err) => {
        console.error("❌ Peer Error:", err);
      });

      peerRef.current = peer;

      await setupLocalVideo();
    } catch (err) {
      console.error(err);
    }
  };

  // ===============================
  // GET LOCAL STREAM
  // ===============================

  const getLocalStream = async () => {
    try {
      if (localStreamRef.current) {
        return localStreamRef.current;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },

        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;

      return stream;
    } catch (error) {
      console.error(error);

      alert("Camera / microphone permission denied");

      throw error;
    }
  };

  // ===============================
  // SETUP LOCAL VIDEO
  // ===============================

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

  // ===============================
  // CALL HANDLERS
  // ===============================

  const setupCallHandlers = (call: any) => {
    call.on("stream", async (remoteStream: MediaStream) => {
      console.log("📺 Remote Stream");

      setTimeout(async () => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;

          try {
            await remoteVideoRef.current.play();
          } catch (err) {
            console.error(err);
          }
        }
      }, 100);
    });

    call.on("close", () => {
      console.log("📴 Call Closed");

      endCall();
    });

    call.on("error", (err: any) => {
      console.error("❌ Call Error:", err);

      endCall();
    });

    const pc = call.peerConnection;

    if (pc) {
      pc.addEventListener("iceconnectionstatechange", () => {
        console.log("ICE:", pc.iceConnectionState);
      });

      pc.addEventListener("connectionstatechange", () => {
        console.log("Connection:", pc.connectionState);
      });
    }
  };

  // ===============================
  // START CALL
  // ===============================

  const startCall = async () => {
    if (!remoteId.trim()) {
      alert("Enter Remote Peer ID");
      return;
    }

    try {
      setIsConnecting(true);

      const stream = await getLocalStream();

      // DATA CONNECTION
      const conn = peerRef.current?.connect(remoteId, {
        reliable: true,
      });

      if (conn) {
        conn.on("open", () => {
          console.log("✅ Data Channel Open");

          dataConnectionRef.current = conn;

          setupDataConnection(conn);
        });
      }

      // MEDIA CALL
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

  // ===============================
  // ACCEPT CALL
  // ===============================

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

  // ===============================
  // REJECT CALL
  // ===============================

  const rejectCall = () => {
    incomingCall.close();

    setIncomingCall(null);
  };

  // ===============================
  // END CALL
  // ===============================

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

  // ===============================
  // DATA CONNECTION
  // ===============================

  const setupDataConnection = (conn: any) => {
    conn.on("data", (data: any) => {
      if (data.type === "chat") {
        addMessage(data.text, "remote");
      }
    });

    conn.on("error", console.error);
  };

  // ===============================
  // CHAT
  // ===============================

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

  // ===============================
  // TOGGLE MIC
  // ===============================

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()?.at(0);

    if (!track) return;

    track.enabled = !track.enabled;

    setMicEnabled(track.enabled);
  };

  // ===============================
  // TOGGLE CAMERA
  // ===============================

  const toggleCamera = () => {
    const track = localStreamRef.current?.getVideoTracks()?.at(0);

    if (!track) return;

    track.enabled = !track.enabled;

    setCameraEnabled(track.enabled);
  };

  // ===============================
  // COPY ID
  // ===============================

  const copyId = async () => {
    await navigator.clipboard.writeText(peerId);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  // ===============================
  // CLEANUP
  // ===============================

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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* HEADER */}

      <div className="p-4 border-b border-gray-800 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">GlideCall</h1>

          <p className="text-sm text-gray-400">Secure P2P Video Call</p>
        </div>

        <button
          onClick={copyId}
          className="bg-gray-800 px-4 py-2 rounded-xl flex items-center gap-2"
        >
          {copied ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          Copy ID
        </button>
      </div>

      {/* MAIN */}

      <div className="flex-1 grid md:grid-cols-2 gap-4 p-4">
        {/* LOCAL VIDEO */}

        <div className="relative bg-gray-900 rounded-2xl overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-full text-sm">
            You
          </div>
        </div>

        {/* REMOTE VIDEO */}

        <div className="relative bg-gray-900 rounded-2xl overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            controls={false}
            className="w-full h-full object-cover"
          />

          {!isInCall && (
            <div className="absolute inset-0 flex items-center justify-center">
              Waiting for connection...
            </div>
          )}
        </div>
      </div>

      {/* CONTROLS */}

      <div className="p-4 border-t border-gray-800 space-y-4">
        {/* YOUR ID */}

        <div className="bg-gray-900 rounded-xl p-3">
          <p className="text-sm text-gray-400">Your Peer ID</p>

          <code className="text-green-400 break-all">{peerId}</code>
        </div>

        {/* REMOTE ID */}

        {!isInCall && (
          <div className="flex gap-2">
            <input
              value={remoteId}
              onChange={(e) => setRemoteId(e.target.value)}
              placeholder="Enter Remote Peer ID"
              className="flex-1 bg-gray-900 rounded-xl px-4 py-3 outline-none"
            />

            <button
              onClick={startCall}
              disabled={isConnecting}
              className="bg-green-500 hover:bg-green-600 px-6 rounded-xl"
            >
              <Phone />
            </button>
          </div>
        )}

        {/* CALL CONTROLS */}

        {isInCall && (
          <div className="flex justify-center gap-4">
            <button
              onClick={toggleMic}
              className={`p-4 rounded-full ${
                micEnabled ? "bg-gray-800" : "bg-red-500"
              }`}
            >
              {micEnabled ? <Mic /> : <MicOff />}
            </button>

            <button onClick={endCall} className="p-4 rounded-full bg-red-500">
              <PhoneOff />
            </button>

            <button
              onClick={toggleCamera}
              className={`p-4 rounded-full ${
                cameraEnabled ? "bg-gray-800" : "bg-red-500"
              }`}
            >
              {cameraEnabled ? <Video /> : <VideoOff />}
            </button>
          </div>
        )}

        {/* CHAT */}

        <div className="bg-gray-900 rounded-2xl p-4 h-64 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "local" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`px-4 py-2 rounded-2xl max-w-xs ${
                    msg.sender === "local" ? "bg-green-500" : "bg-gray-700"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Type message..."
              className="flex-1 bg-black rounded-xl px-4 py-2 outline-none"
            />

            <button
              onClick={sendMessage}
              className="bg-green-500 px-4 rounded-xl"
            >
              <Send />
            </button>
          </div>
        </div>
      </div>

      {/* INCOMING CALL */}

      {incomingCall && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-8 rounded-3xl text-center">
            <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>

            <p className="text-gray-400 mb-6">{incomingCall.peer}</p>

            <div className="flex gap-4 justify-center">
              <button
                onClick={rejectCall}
                className="bg-red-500 p-4 rounded-full"
              >
                <PhoneOff />
              </button>

              <button
                onClick={acceptCall}
                className="bg-green-500 p-4 rounded-full"
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
