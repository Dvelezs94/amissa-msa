import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AndroidAppDownloadLink } from "@/components/AndroidAppDownloadLink";
import Link from "next/link";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/tareas");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/amissa-logo.png"
        alt="Amissa"
        width={96}
        height={111}
        className="mb-5 h-24 w-auto rounded-2xl"
      />
      <h1 className="mb-1 text-2xl font-bold uppercase tracking-tight text-accent-500">
        MSA
      </h1>
      <p className="mb-8 text-center text-zinc-600">
        Maintenance Software Assistant
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/login"
          className="rounded-xl bg-primary-600 text-white py-3 px-4 text-center font-medium tap-target"
        >
          Iniciar sesión
        </Link>
        <Link
          href="/orden"
          className="rounded-xl border border-zinc-300 py-3 px-4 text-center font-medium tap-target text-zinc-700"
        >
          Abrir orden
        </Link>
        <Link
          href="/orden/consultar"
          className="rounded-xl border border-primary-200 bg-primary-50 py-3 px-4 text-center font-medium text-primary-800 tap-target hover:bg-primary-100"
        >
          Consultar por folio o email
        </Link>
      </div>
      <AndroidAppDownloadLink />
    </div>
  );
}
