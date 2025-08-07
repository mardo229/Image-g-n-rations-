const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  const entry = req.body.entry?.[0];
  const event = entry?.messaging?.[0];
  const senderId = event?.sender?.id;
  const messageText = event?.message?.text;

  if (!messageText) return res.sendStatus(200);

  try {
    // Appel à l’API Replicate pour générer l’image
    const replicateRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "a9758cbf44c045f295fa9b303c8f16575c83b4f13d857a77209f69de3c5a0f63", // Stable Diffusion XL
        input: { prompt: messageText }
      })
    });

    const prediction = await replicateRes.json();
    const imageUrl = prediction.output?.[0];

    if (!imageUrl) {
      throw new Error("Image non générée");
    }

    // Envoi de l’image à l’utilisateur via Messenger
    await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: senderId },
        message: {
          attachment: {
            type: "image",
            payload: {
              url: imageUrl,
              is_reusable: true
            }
          }
        }
      })
    });

    res.sendStatus(200);
  } catch (err) {
    console.error("Erreur :", err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Bot en ligne sur le port ${PORT}`);
});
