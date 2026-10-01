"use client";

import { useSetPageHeader } from "@/components/PageHeaderContext";

export function TareasPageHeader() {
  useSetPageHeader({ title: "Tareas" });
  return null;
}
