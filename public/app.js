import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";


function runAdminPage() {
const firebaseConfig = {
      apiKey: "AIzaSyCPiBcLcT-D22NU_wog3tMsPx8Mt-Mugkw",
      authDomain: "bigdansblog.firebaseapp.com",
      projectId: "bigdansblog",
      storageBucket: "bigdansblog.firebasestorage.app",
      messagingSenderId: "658236910222",
      appId: "1:658236910222:web:e131075a61c935555077df",
      measurementId: "G-TMPB4D815P"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);

    // ---- TMDB CONFIG (ADMIN ONLY) ----
    // Replace INSERTTOKENHERE with your TMDB v3 API key string.
    const TMDB_API_KEY = "99d2b566ed84053f039ef7bb723492fb";

    async function fetchPosterUrlForTitle(title) {
      if (!title || !TMDB_API_KEY) return null;

      const url = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        title
      )}`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error("TMDB error:", res.status, res.statusText);
          return null;
        }

        const json = await res.json();
        if (!json.results || !json.results.length) return null;

        // Prefer a result that actually has a poster
        const firstWithPoster =
          json.results.find(r => r.poster_path) || json.results[0];

        if (!firstWithPoster.poster_path) return null;

        // TMDB image CDN; 2:3-ish ratio and good quality
        return `https://image.tmdb.org/t/p/w500${firstWithPoster.poster_path}`;
      } catch (err) {
        console.error("Error fetching TMDB poster:", err);
        return null;
      }
    }

    const loginSection = document.getElementById("login-section");
    const postSection = document.getElementById("post-section");
    const aboutSection = document.getElementById("about-section");

    const loginForm = document.getElementById("login-form");
    const loginMessage = document.getElementById("login-message");

    const postForm = document.getElementById("post-form");
    const postMessage = document.getElementById("post-message");
    const userInfo = document.getElementById("user-info");
    const logoutButton = document.getElementById("logout-button");
    const postList = document.getElementById("post-list");
    const postSubmitButton = document.getElementById("post-submit-button");
    const cancelEditButton = document.getElementById("cancel-edit-button");

    const aboutForm = document.getElementById("about-form");
    const aboutContent = document.getElementById("about-content");
    const aboutMessage = document.getElementById("about-message");

    const mediaTitleInput = document.getElementById("post-media-title");

    let editingId = null; // null = creating, not editing
    let editingOriginalMediaTitle = "";
    let editingOriginalPosterUrl = null;

    function setEditingMode(postId = null, data = null) {
      editingId = postId;

      if (postId && data) {
        // fill form for editing
        document.getElementById("post-title").value = data.title || "";
        document.getElementById("post-content").value = data.content || "";
        mediaTitleInput.value = data.mediaTitle || "";

        editingOriginalMediaTitle = data.mediaTitle || "";
        editingOriginalPosterUrl = data.posterUrl || null;

        postSubmitButton.textContent = "save changes";
        cancelEditButton.classList.remove("hidden");
        postMessage.textContent = "";
        postMessage.className = "";
        postSection.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // back to create mode
        editingId = null;
        editingOriginalMediaTitle = "";
        editingOriginalPosterUrl = null;
        postForm.reset();
        mediaTitleInput.value = "";
        postSubmitButton.textContent = "publish review";
        cancelEditButton.classList.add("hidden");
        postMessage.textContent = "";
        postMessage.className = "";
      }
    }

    function formatDateOnly(ts) {
      try {
        const d = ts.toDate();
        return d.toLocaleDateString(); // date only, no time
      } catch {
        return "";
      }
    }

    async function loadAdminPosts() {
      postList.innerHTML = "<p class='logged-in-note'>loading reviews…</p>";
      try {
        const postsQuery = query(
          collection(db, "posts"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(postsQuery);

        if (snapshot.empty) {
          postList.innerHTML = "<p class='logged-in-note'>no reviews yet.</p>";
          return;
        }

        const all = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          all.push({ id: docSnap.id, data });
        });

        // pinned first, then others. within each group, keep createdAt order.
        const pinned = all.filter((p) => p.data.pinned === true);
        const unpinned = all.filter((p) => !p.data.pinned);

        const renderList = (items) =>
          items
            .map(({ id, data }) => {
              const dateStr =
                data.createdAt && typeof data.createdAt.toDate === "function"
                  ? formatDateOnly(data.createdAt)
                  : "";
              const pinnedBadge = data.pinned
                ? `<span class="pinned-badge">pinned</span>`
                : "";
              return `
                <div class="post-row" data-id="${id}">
                  <div class="post-row-main">
                    <p class="post-row-title">${data.title || "untitled"}${pinnedBadge}</p>
                    ${dateStr ? `<p class="post-row-meta">${dateStr}</p>` : ""}
                  </div>
                  <div class="post-row-actions">
                    <button class="small-button" data-action="edit">edit</button>
                    <button class="small-button" data-action="pin">
                      ${data.pinned ? "unpin" : "pin"}
                    </button>
                    <button class="delete-button" data-action="delete">delete</button>
                  </div>
                </div>
              `;
            })
            .join("");

        postList.innerHTML = renderList(pinned) + renderList(unpinned);

        // attach handlers
        postList.querySelectorAll(".post-row").forEach((row) => {
          const id = row.getAttribute("data-id");

          row.querySelectorAll("button").forEach((btn) => {
            const action = btn.getAttribute("data-action");

            if (action === "edit") {
              btn.addEventListener("click", () => {
                const found = all.find((p) => p.id === id);
                if (found) {
                  setEditingMode(id, found.data);
                }
              });
            }

            if (action === "pin") {
              btn.addEventListener("click", async () => {
                const found = all.find((p) => p.id === id);
                if (!found) return;
                try {
                  await updateDoc(doc(db, "posts", id), {
                    pinned: !found.data.pinned
                  });
                  await loadAdminPosts();
                } catch (err) {
                  console.error(err);
                  alert("could not update pin state.");
                }
              });
            }

            if (action === "delete") {
              btn.addEventListener("click", async () => {
                const confirmed = window.confirm("delete this review?");
                if (!confirmed) return;
                try {
                  await deleteDoc(doc(db, "posts", id));
                  if (editingId === id) {
                    setEditingMode(null);
                  }
                  await loadAdminPosts();
                } catch (err) {
                  console.error(err);
                  alert("could not delete review.");
                }
              });
            }
          });
        });
      } catch (err) {
        console.error(err);
        postList.innerHTML =
          "<p class='logged-in-note'>couldn’t load reviews.</p>";
      }
    }

    async function loadAboutPage() {
      try {
        const ref = doc(db, "site", "about");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          aboutContent.value = data.content || "";
        } else {
          aboutContent.value = "";
        }
      } catch (err) {
        console.error(err);
        aboutMessage.textContent = "couldn’t load about page.";
        aboutMessage.className = "error";
      }
    }

    function setLoginState(user, scrollToPost = false) {
      if (user) {
        // show admin ui
        loginSection.classList.add("hidden");
        postSection.classList.remove("hidden");
        aboutSection.classList.remove("hidden");
        logoutButton.classList.remove("hidden");

        userInfo.textContent = `signed in as ${user.email}`;

        loadAdminPosts();
        loadAboutPage();

        if (scrollToPost) {
          postSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        // logged out: only show login
        loginSection.classList.remove("hidden");
        postSection.classList.add("hidden");
        aboutSection.classList.add("hidden");
        logoutButton.classList.add("hidden");

        userInfo.textContent = "";
        setEditingMode(null);
      }

      loginMessage.textContent = "";
      loginMessage.className = "";
      postMessage.textContent = "";
      postMessage.className = "";
      aboutMessage.textContent = "";
      aboutMessage.className = "";
    }

    // auth state
    onAuthStateChanged(auth, (user) => {
      setLoginState(user, false);
    });

    // login submit
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginMessage.textContent = "";
      loginMessage.className = "";

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;

      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        setLoginState(cred.user, true);
      } catch (err) {
        console.error(err);
        loginMessage.textContent =
          "could not sign in. check your email and password.";
        loginMessage.className = "error";
      }
    });

    // new review submit (create or edit)
    postForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      postMessage.textContent = "";
      postMessage.className = "";

      const title = document.getElementById("post-title").value.trim();
      const content = document.getElementById("post-content").value.trim();
      const mediaTitle = mediaTitleInput.value.trim();

      if (!title || !content) {
        postMessage.textContent = "please fill in both title and content.";
        postMessage.className = "error";
        return;
      }

      try {
        if (editingId) {
          // EDIT EXISTING POST
          const updateData = {
            title,
            content,
            mediaTitle: mediaTitle || ""
          };

          let shouldRefetchPoster = false;

          // If media title changed, we refetch
          if (mediaTitle && mediaTitle !== editingOriginalMediaTitle) {
            shouldRefetchPoster = true;
          }

          // If previously had no poster but now we have a title, also fetch
          if (!editingOriginalPosterUrl && mediaTitle) {
            shouldRefetchPoster = true;
          }

          if (shouldRefetchPoster) {
            const searchTitle = mediaTitle || title;
            const newPosterUrl = await fetchPosterUrlForTitle(searchTitle);
            if (newPosterUrl) {
              updateData.posterUrl = newPosterUrl;
            }
          }

          await updateDoc(doc(db, "posts", editingId), updateData);
          postMessage.textContent = "review updated.";
          postMessage.className = "success";
        } else {
          // NEW POST
          const searchTitle = mediaTitle || title;
          let posterUrl = null;

          if (searchTitle) {
            posterUrl = await fetchPosterUrlForTitle(searchTitle);
          }

          await addDoc(collection(db, "posts"), {
            title,
            content,
            mediaTitle: mediaTitle || "",
            createdAt: serverTimestamp(),
            pinned: false,
            posterUrl: posterUrl || null
          });

          postMessage.textContent = "review published.";
          postMessage.className = "success";
        }

        setEditingMode(null);
        await loadAdminPosts();
      } catch (err) {
        console.error(err);
        postMessage.textContent = "could not publish review.";
        postMessage.className = "error";
      }
    });

    // cancel edit
    cancelEditButton.addEventListener("click", () => {
      setEditingMode(null);
    });

    // save about page
    aboutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      aboutMessage.textContent = "";
      aboutMessage.className = "";

      if (!auth.currentUser) {
        aboutMessage.textContent = "please sign in to edit the about page.";
        aboutMessage.className = "error";
        return;
      }

      const content = aboutContent.value.trim();
      if (!content) {
        aboutMessage.textContent = "about text cannot be empty.";
        aboutMessage.className = "error";
        return;
      }

      try {
        await setDoc(doc(db, "site", "about"), {
          content
        });
        aboutMessage.textContent = "about page updated.";
        aboutMessage.className = "success";
      } catch (err) {
        console.error(err);
        aboutMessage.textContent = "could not update about page.";
        aboutMessage.className = "error";
      }
    });

    // logout
    logoutButton.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (err) {
        console.error(err);
      }
    });
}

function runIndexPage() {
const firebaseConfig = {
      apiKey: "AIzaSyCPiBcLcT-D22NU_wog3tMsPx8Mt-Mugkw",
      authDomain: "bigdansblog.firebaseapp.com",
      projectId: "bigdansblog",
      storageBucket: "bigdansblog.firebasestorage.app",
      messagingSenderId: "658236910222",
      appId: "1:658236910222:web:e131075a61c935555077df",
      measurementId: "G-TMPB4D815P"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // ----- ABOUT PAGE (from Firestore only) -----
    let aboutLoaded = false;

    async function loadAbout() {
      if (aboutLoaded) return;
      const aboutEl = document.getElementById("about-text");
      const statusEl = document.getElementById("about-status");
      if (!aboutEl) return;

      statusEl.textContent = "loading about…";

      try {
        const snap = await getDoc(doc(db, "site", "about"));
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data.content === "string" && data.content.trim()) {
            aboutEl.textContent = data.content;
            statusEl.textContent = "";
          } else {
            aboutEl.textContent = "";
            statusEl.textContent = "about page is empty.";
          }
        } else {
          aboutEl.textContent = "";
          statusEl.textContent = "about page not found.";
        }
      } catch (err) {
        console.error("error loading about page:", err);
        aboutEl.textContent = "";
        statusEl.textContent = "couldn’t load about page.";
      } finally {
        aboutLoaded = true;
      }
    }

    // ----- REVIEWS -----
    async function loadPosts() {
      const container = document.getElementById("posts");
      container.innerHTML = '<p class="empty-message">loading…</p>';

      try {
        const postsQuery = query(
          collection(db, "posts"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(postsQuery);

        if (snapshot.empty) {
          container.innerHTML =
            '<p class="empty-message">no reviews yet.</p>';
          return;
        }

        const all = [];
        snapshot.forEach(docSnap => {
          all.push({ id: docSnap.id, data: docSnap.data() });
        });

        const pinned = all.filter(p => p.data.pinned === true);
        const unpinned = all.filter(p => !p.data.pinned);

        function formatDateOnly(ts) {
          try {
            const d = ts.toDate();
            return d.toLocaleDateString();
          } catch {
            return "";
          }
        }

        const renderCard = ({ id, data }) => {
          let dateStr = "";
          if (data.createdAt && typeof data.createdAt.toDate === "function") {
            dateStr = formatDateOnly(data.createdAt);
          }

          const pinnedBadge = data.pinned
            ? " · pinned"
            : "";

          return `
            <article class="post-card">
              <h3 class="post-title">
                <a href="post.html?id=${encodeURIComponent(id)}" class="post-link">
                  ${data.title || "untitled"}
                </a>
              </h3>
              ${
                dateStr
                  ? `<p class="post-meta">${dateStr}${pinnedBadge}</p>`
                  : ""
              }
            </article>
          `;
        };

        container.innerHTML =
          pinned.map(renderCard).join("") +
          unpinned.map(renderCard).join("");
      } catch (err) {
        console.error("error loading posts:", err);
        container.innerHTML =
          '<p class="empty-message">couldn’t load reviews. try again later.</p>';
      }
    }

    // ----- LAYER + TAB LOGIC -----
    const welcomeLayer = document.getElementById("welcome-layer");
    const appLayer = document.getElementById("app-layer");
    const enterButton = document.getElementById("enterButton");
    const tabButtons = document.querySelectorAll(".tab-button");
    const aboutSection = document.getElementById("about");
    const reviewsSection = document.getElementById("reviews");

    function showAppLayer(defaultTab = "about") {
      welcomeLayer.classList.add("hidden");
      appLayer.classList.remove("hidden");
      setActiveTab(defaultTab);
    }

    function setActiveTab(tabName) {
      tabButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.target === tabName);
      });

      if (tabName === "about") {
        aboutSection.classList.remove("hidden");
        reviewsSection.classList.add("hidden");
        loadAbout();
      } else {
        aboutSection.classList.add("hidden");
        reviewsSection.classList.remove("hidden");
        loadPosts();
      }
    }

    // Decide what to show on first load based on URL hash
    if (window.location.hash === "#reviews") {
      showAppLayer("reviews");
    } else {
      welcomeLayer.classList.remove("hidden");
      appLayer.classList.add("hidden");
    }

    enterButton.addEventListener("click", () => {
      showAppLayer("about");
      loadAbout();
    });

    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        setActiveTab(btn.dataset.target);
      });
    });
}

function runPostPage() {
const firebaseConfig = {
      apiKey: "AIzaSyCPiBcLcT-D22NU_wog3tMsPx8Mt-Mugkw",
      authDomain: "bigdansblog.firebaseapp.com",
      projectId: "bigdansblog",
      storageBucket: "bigdansblog.firebasestorage.app",
      messagingSenderId: "658236910222",
      appId: "1:658236910222:web:e131075a61c935555077df",
      measurementId: "G-TMPB4D815P"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const mainEl = document.getElementById("content");

    function getPostIdFromUrl() {
      const params = new URLSearchParams(window.location.search);
      return params.get("id");
    }

    async function loadPost() {
      const postId = getPostIdFromUrl();

      if (!postId) {
        mainEl.innerHTML = '<p class="message">No post id provided.</p>';
        return;
      }

      try {
        const ref = doc(db, "posts", postId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          mainEl.innerHTML = '<p class="message">That post could not be found.</p>';
          return;
        }

        const data = snap.data();

        let dateStr = "";
        if (data.createdAt && typeof data.createdAt.toDate === "function") {
          const date = data.createdAt.toDate();
          dateStr = date.toLocaleDateString(); // date only
        }

        const posterHtml = data.posterUrl
          ? `<div class="post-poster-wrapper">
               <img
                 class="post-poster"
                 src="${data.posterUrl}"
                 alt="${(data.mediaTitle || data.title || "poster")}"
               />
             </div>`
          : "";

        mainEl.innerHTML = `
          <article>
            <h2 class="post-title">${data.title || "Untitled"}</h2>
            ${dateStr ? `<p class="post-meta">${dateStr}</p>` : ""}
            ${posterHtml}
            <p class="post-body">${data.content || ""}</p>
          </article>
        `;
      } catch (err) {
        console.error(err);
        mainEl.innerHTML = '<p class="message">Couldn’t load this post.</p>';
      }
    }

    loadPost();
}

const page = document.body && document.body.dataset ? document.body.dataset.page : "";
if (page === "admin") {
  runAdminPage();
} else if (page === "index") {
  runIndexPage();
} else if (page === "post") {
  runPostPage();
}
