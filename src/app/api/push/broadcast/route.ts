import { NextResponse } from "next/server";
import { sendPushToUsers } from "@/utils/push-utils";

export async function POST(req: Request) {
  try {
    const { title, message, url, targetIds } = await req.json();

    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      return NextResponse.json({ message: "No target user IDs provided" }, { status: 400 });
    }

    await sendPushToUsers(targetIds, {
      title: title || "📋 Nueva Actividad Asignada",
      body: message || "Se te ha asignado una nueva actividad en COMUDE",
      url: url || "/comude",
    });

    return NextResponse.json({ success: true, message: `Push notifications broadcasted to ${targetIds.length} user(s).` });
  } catch (err: any) {
    console.error("Push Broadcast Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
