import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  onChildAdded,
  push
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

import {
  getAuth,
  signInAnonymously
} from
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


// =============================
// FIREBASE
// =============================

const firebaseConfig = {
  apiKey: "AIzaSyD5kH_VWXI2r_znQbhlHenqDEZBJmnJcFM",
  authDomain: "camra-share.firebaseapp.com",
  databaseURL: "https://camra-share-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "camra-share",
  storageBucket: "camra-share.firebasestorage.app",
  messagingSenderId: "618409884143",
  appId: "1:618409884143:web:d787884065b651f54f9e1a",
  measurementId: "G-ZLF7B4GFR4"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

await signInAnonymously(auth);


// =============================
// ELEMENTS
// =============================

const home = document.getElementById("home");
const guest = document.getElementById("guest");
const host = document.getElementById("host");

const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");

const createBtn = document.getElementById("createBtn");
const shareBtn = document.getElementById("shareBtn");

const status = document.getElementById("status");
const hostStatus = document.getElementById("hostStatus");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const localWrap = document.getElementById("localWrap");
const remotePlaceholder =
  document.getElementById("remotePlaceholder");

const inviteBox =
  document.getElementById("inviteBox");

const inviteLink =
  document.getElementById("inviteLink");

const copyBtn =
  document.getElementById("copyBtn");


// =============================
// WEBRTC
// =============================

let peerConnection = null;
let localStream = null;
let roomId = null;

let remoteDescriptionReady = false;
let remoteCandidateQueue = [];


const rtcConfig = {

  iceServers: [

    {
      urls: "stun:stun.l.google.com:19302"
    },

    {
      urls: "stun:stun1.l.google.com:19302"
    }

  ]

};


// =============================
// HELPERS
// =============================

function generateRoomId() {

  if (crypto.randomUUID) {

    return crypto
      .randomUUID()
      .replaceAll("-", "")
      .slice(0, 12);

  }

  return Math.random()
    .toString(36)
    .slice(2, 14);

}


function showOnly(section) {

  home.classList.add("hidden");
  guest.classList.add("hidden");
  host.classList.add("hidden");

  section.classList.remove("hidden");

}


function newPeerConnection() {

  return new RTCPeerConnection(
    rtcConfig
  );

}


async function addRemoteCandidate(candidate) {

  if (!peerConnection || !candidate) {
    return;
  }

  const iceCandidate =
    new RTCIceCandidate(candidate);


  if (!remoteDescriptionReady) {

    remoteCandidateQueue.push(
      iceCandidate
    );

    return;

  }


  try {

    await peerConnection
      .addIceCandidate(
        iceCandidate
      );

  } catch (error) {

    console.log(
      "ICE error:",
      error
    );

  }

}


async function flushCandidates() {

  if (!peerConnection) {
    return;
  }


  for (
    const candidate
    of remoteCandidateQueue
  ) {

    try {

      await peerConnection
        .addIceCandidate(
          candidate
        );

    } catch (error) {

      console.log(
        "Queued ICE error:",
        error
      );

    }

  }


  remoteCandidateQueue = [];

}


function stopCamera() {

  if (!localStream) {
    return;
  }


  localStream
    .getTracks()
    .forEach(track => {
      track.stop();
    });


  localStream = null;

  localVideo.srcObject = null;

  localWrap.classList.add(
    "hidden"
  );

}


// =============================
// HOST
// =============================

createBtn.addEventListener(
  "click",
  async () => {

    createBtn.disabled = true;

    try {

      roomId =
        generateRoomId();


      showOnly(host);


      hostStatus.textContent =
        "🔄 Room बनाया जा रहा है...";


      peerConnection =
        newPeerConnection();


      // Host only RECEIVES video.
      // Host camera is never requested.

      peerConnection
        .addTransceiver(
          "video",
          {
            direction: "recvonly"
          }
        );


      // Guest video arrives here.

      peerConnection.ontrack =
        event => {

          console.log(
            "Guest video received"
          );


          if (
            event.streams &&
            event.streams[0]
          ) {

            remoteVideo.srcObject =
              event.streams[0];


            remotePlaceholder
              .classList
              .add("hidden");


            hostStatus.textContent =
              "🟢 Guest का live camera दिखाई दे रहा है।";

          }

        };


      peerConnection
        .onconnectionstatechange =
        () => {

          const state =
            peerConnection
              .connectionState;


          console.log(
            "Host connection:",
            state
          );


          if (
            state === "connected"
          ) {

            hostStatus.textContent =
              "🟢 Guest का live camera connected है।";

          }


          if (
            state === "connecting"
          ) {

            hostStatus.textContent =
              "🔄 Camera connection हो रही है...";

          }


          if (
            state === "failed"
          ) {

            hostStatus.textContent =
              "❌ Connection failed. Internet check करें।";

          }

        };


      // Host ICE

      peerConnection.onicecandidate =
        async event => {

          if (!event.candidate) {
            return;
          }


          const candidateRef =
            push(
              ref(
                db,
                `rooms/${roomId}/hostCandidates`
              )
            );


          await set(
            candidateRef,
            event.candidate.toJSON()
          );

        };


      // Create offer

      const offer =
        await peerConnection
          .createOffer();


      await peerConnection
        .setLocalDescription(
          offer
        );


      // Save offer

      await set(
        ref(
          db,
          `rooms/${roomId}/offer`
        ),
        {
          type: offer.type,
          sdp: offer.sdp
        }
      );


      // Guest link

      const url =
        new URL(
          window.location.href
        );


      url.search = "";

      url.searchParams.set(
        "room",
        roomId
      );


      inviteLink.value =
        url.toString();


      inviteBox
        .classList
        .remove("hidden");


      hostStatus.textContent =
        "🟡 Guest को link भेजें।";


      // Copy button

      copyBtn.onclick =
        async () => {

          try {

            await navigator
              .clipboard
              .writeText(
                inviteLink.value
              );


            copyBtn.textContent =
              "✅ Copied";


            setTimeout(
              () => {

                copyBtn.textContent =
                  "Copy";

              },
              2000
            );

          } catch {

            inviteLink.select();

            document
              .execCommand("copy");

          }

        };


      // Wait for guest answer

      onValue(
        ref(
          db,
          `rooms/${roomId}/answer`
        ),

        async snapshot => {

          const answer =
            snapshot.val();


          if (!answer) {
            return;
          }


          if (
            peerConnection
              .currentRemoteDescription
          ) {

            return;

          }


          try {

            await peerConnection
              .setRemoteDescription(
                new RTCSessionDescription(
                  answer
                )
              );


            remoteDescriptionReady =
              true;


            await flushCandidates();


            hostStatus.textContent =
              "🔄 Guest camera connection स्थापित हो रही है...";


          } catch (error) {

            console.log(
              "Answer error:",
              error
            );

          }

        }

      );


      // Guest ICE

      onChildAdded(
        ref(
          db,
          `rooms/${roomId}/guestCandidates`
        ),

        async snapshot => {

          await addRemoteCandidate(
            snapshot.val()
          );

        }

      );


    } catch (error) {

      console.error(error);

      createBtn.disabled =
        false;


      hostStatus.textContent =
        "❌ Room बनाने में problem हुई।";

    }

  }

);


// =============================
// GUEST
// =============================

const params =
  new URLSearchParams(
    window.location.search
  );


const guestRoomId =
  params.get("room");


if (guestRoomId) {

  roomId =
    guestRoomId;


  showOnly(guest);


  shareBtn.addEventListener(
    "click",
    async () => {

      shareBtn.disabled =
        true;


      try {

        status.textContent =
          "📷 Camera permission माँगी जा रही है...";


        // IMPORTANT:
        // Camera ONLY after user clicks.

        localStream =
          await navigator
            .mediaDevices
            .getUserMedia({

              video: {

                facingMode:
                  "environment",

                width: {
                  ideal: 1280
                },

                height: {
                  ideal: 720
                }

              },

              audio: false

            });


        // Show guest's own camera

        localVideo.srcObject =
          localStream;


        localWrap
          .classList
          .remove("hidden");


        status.textContent =
          "✅ Camera permission मिल गई। Connecting...";


        // Check room

        const roomSnapshot =
          await get(
            ref(
              db,
              `rooms/${roomId}`
            )
          );


        if (
          !roomSnapshot.exists()
        ) {

          stopCamera();

          shareBtn.disabled =
            false;


          status.textContent =
            "❌ Room नहीं मिला।";

          return;

        }


        // WebRTC

        peerConnection =
          newPeerConnection();


        // Add camera tracks

        localStream
          .getTracks()
          .forEach(
            track => {

              peerConnection
                .addTrack(
                  track,
                  localStream
                );

            }
          );


        // Guest connection status

        peerConnection
          .onconnectionstatechange =
          () => {

            const state =
              peerConnection
                .connectionState;


            console.log(
              "Guest connection:",
              state
            );


            if (
              state === "connected"
            ) {

              status.textContent =
                "🟢 आपका camera दूसरे व्यक्ति को live दिखाई दे रहा है।";

            }


            if (
              state === "failed"
            ) {

              status.textContent =
                "❌ Camera connection failed.";

              shareBtn.disabled =
                false;

            }

          };


        // Guest ICE

        peerConnection.onicecandidate =
          async event => {

            if (!event.candidate) {
              return;
            }


            const candidateRef =
              push(
                ref(
                  db,
                  `rooms/${roomId}/guestCandidates`
                )
              );


            await set(
              candidateRef,
              event.candidate.toJSON()
            );

          };


        // Get offer

        const offerSnapshot =
          await get(
            ref(
              db,
              `rooms/${roomId}/offer`
            )
          );


        if (
          !offerSnapshot.exists()
        ) {

          stopCamera();

          shareBtn.disabled =
            false;


          status.textContent =
            "❌ Room का offer नहीं मिला।";

          return;

        }


        const offer =
          offerSnapshot.val();


        await peerConnection
          .setRemoteDescription(
            new RTCSessionDescription(
              offer
            )
          );


        remoteDescriptionReady =
          true;


        await flushCandidates();


        // Create answer

        const answer =
          await peerConnection
            .createAnswer();


        await peerConnection
          .setLocalDescription(
            answer
          );


        // Save answer

        await set(
          ref(
            db,
            `rooms/${roomId}/answer`
          ),
          {
            type: answer.type,
            sdp: answer.sdp
          }
        );


        // Host ICE

        onChildAdded(
          ref(
            db,
            `rooms/${roomId}/hostCandidates`
          ),

          async snapshot => {

            await addRemoteCandidate(
              snapshot.val()
            );

          }

        );


      } catch (error) {

        console.error(
          "Camera error:",
          error
        );


        shareBtn.disabled =
          false;


        if (
          error.name ===
          "NotAllowedError"
        ) {

          status.textContent =
            "🚫 Camera permission denied. Camera शुरू नहीं किया गया।";

        } else {

          status.textContent =
            "❌ Camera/connection error: " +
            (error.message ||
             error.name);

        }

      }

    }

  );

}


// =============================
// PAGE CLOSE
// =============================

window.addEventListener(
  "pagehide",
  () => {

    stopCamera();


    if (peerConnection) {

      peerConnection.close();

      peerConnection =
        null;

    }

  }
);
