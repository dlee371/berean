"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Deletes one conversation (its messages go with it). RLS means this can only ever
// delete the current user's own conversation, even if someone sends another id.
export async function deleteConversation(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const supabase = await createClient();
  const { error } = await supabase.from("conversations").delete().eq("id", id.data);
  if (error) console.error("Delete failed:", error.message);

  revalidatePath("/history"); // tell Next.js to redraw the list
}
