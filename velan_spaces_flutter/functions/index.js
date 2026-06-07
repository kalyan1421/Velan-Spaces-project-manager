/**
 * Velan Spaces — Firebase Cloud Functions
 * Project: velan-spaces-constructions (502284969422)
 *
 * This function bridges in-app notifications → real push notifications.
 * Trigger: Any new document written to users/{userId}/notifications/{notifId}
 * Action:  Sends FCM push to every device token stored at users/{userId}/fcmTokens
 *
 * This means every in-app notification trigger (update posted, design uploaded,
 * settlement logged, project assigned, worker added) automatically fires a push
 * to the recipient's phone — even when the app is closed.
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp }     = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging }      = require("firebase-admin/messaging");

initializeApp();

// ─── Push notification trigger ────────────────────────────────────────────────
exports.sendPushOnNotification = onDocumentCreated(
  {
    document: "users/{userId}/notifications/{notifId}",
    region: "us-central1", // default region — works without App Engine setup
  },
  async (event) => {
    const notifData = event.data?.data();
    const { userId, notifId } = event.params;

    if (!notifData) {
      console.log(`[${notifId}] Empty notification doc — skipping`);
      return;
    }

    const { title, body, projectId = "", type = "" } = notifData;

    if (!title || !body) {
      console.log(`[${notifId}] Missing title/body — skipping push`);
      return;
    }

    // ── Fetch recipient's FCM tokens ─────────────────────────────────────────
    const db = getFirestore();
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      console.log(`[${notifId}] User doc not found for userId=${userId}`);
      return;
    }

    const fcmTokens = (userDoc.data()?.fcmTokens || []).filter(Boolean);

    if (fcmTokens.length === 0) {
      console.log(`[${notifId}] No FCM tokens for userId=${userId} — push skipped`);
      return;
    }

    console.log(`[${notifId}] Sending push to ${fcmTokens.length} device(s) for ${userId}`);

    // ── Build multicast message ───────────────────────────────────────────────
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        projectId: String(projectId),
        type:      String(type),
        notifId:   String(notifId),
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "velan_spaces_notifications",
          sound: "default",
          priority: "high",
          defaultSound: true,
        },
      },
      apns: {
        headers: {
          "apns-priority": "10",
        },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            contentAvailable: true,
          },
        },
      },
      tokens: fcmTokens,
    };

    // ── Send & clean up stale tokens ─────────────────────────────────────────
    try {
      const response = await getMessaging().sendEachForMulticast(message);

      console.log(
        `✅ FCM result: ${response.successCount} success / ${response.failureCount} failed`
      );

      // Remove invalid / expired tokens automatically
      const staleTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code ?? "";
          console.warn(`  Token[${idx}] failed: ${code}`);
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            staleTokens.push(fcmTokens[idx]);
          }
        }
      });

      if (staleTokens.length > 0) {
        console.log(`🗑️ Removing ${staleTokens.length} stale token(s)`);
        await db.collection("users").doc(userId).update({
          fcmTokens: FieldValue.arrayRemove(...staleTokens),
        });
      }
    } catch (error) {
      console.error("❌ FCM send error:", error);
    }
  }
);
