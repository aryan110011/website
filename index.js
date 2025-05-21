// server/index.js

const express = require("express");
const fs = require("fs");
const fetch = require("node-fetch");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const SESSIONS_DIR = "./sessions";
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

function getSessionPath(convoName) {
  return `${SESSIONS_DIR}/${convoName}.json`;
}

function saveSession(convoName, data) {
  fs.writeFileSync(getSessionPath(convoName), JSON.stringify(data, null, 2));
}

function loadSession(convoName) {
  const path = getSessionPath(convoName);
  if (!fs.existsSync(path)) return null;
  return JSON.parse(fs.readFileSync(path));
}

function deleteSession(convoName) {
  const path = getSessionPath(convoName);
  if (fs.existsSync(path)) fs.unlinkSync(path);
}

async function sendMessage(token, convoId, message) {
  const url = `https://graph.facebook.com/v15.0/t_${convoId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message })
  });

  const result = await res.json();
  return result;
}

let activeConvos = {};

app.post("/start_convo", async (req, res) => {
  const { token, targetId, hatterName, messages, delay, convoName } = req.body;

  if (activeConvos[convoName]) return res.json({ error: "Already running" });

  let index = 0;
  const session = { token, targetId, hatterName, messages, delay, index, running: true };
  saveSession(convoName, session);

  const runner = async () => {
    while (index < messages.length && session.running) {
      const msg = `${hatterName}: ${messages[index]}`;
      await sendMessage(token, targetId, msg);
      index++;
      session.index = index;
      saveSession(convoName, session);
      await new Promise(r => setTimeout(r, delay * 1000));
    }
    session.running = false;
    saveSession(convoName, session);
    delete activeConvos[convoName];
  };

  session.running = true;
  activeConvos[convoName] = true;
  runner();

  res.json({ message: "Convo started" });
});

app.post("/view_convo", (req, res) => {
  const { convoName } = req.body;
  const session = loadSession(convoName);
  if (!session) return res.json({ error: "Not found" });
  res.json(session);
});

app.post("/resume_convo", (req, res) => {
  const { convoName } = req.body;
  const session = loadSession(convoName);
  if (!session || session.running) return res.json({ error: "Not paused or not found" });

  let { token, targetId, hatterName, messages, delay, index } = session;

  const runner = async () => {
    while (index < messages.length && session.running) {
      const msg = `${hatterName}: ${messages[index]}`;
      await sendMessage(token, targetId, msg);
      index++;
      session.index = index;
      saveSession(convoName, session);
      await new Promise(r => setTimeout(r, delay * 1000));
    }
    session.running = false;
    saveSession(convoName, session);
    delete activeConvos[convoName];
  };

  session.running = true;
  activeConvos[convoName] = true;
  runner();

  res.json({ message: "Convo resumed" });
});

app.post("/stop_convo", (req, res) => {
  const { convoName } = req.body;
  const session = loadSession(convoName);
  if (!session) return res.json({ error: "Not found" });

  session.running = false;
  saveSession(convoName, session);
  delete activeConvos[convoName];

  res.json({ message: "Stopped convo and paused state" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
