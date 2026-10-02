import Image from "next/image";
import { notFound } from "next/navigation";
import { SetPageHeader } from "@/components/SetPageHeader";
import {
  DOCS_CALENDAR_TO_TASK_STEPS,
  DOCS_CHECKLIST_REVISION_STEPS,
  DOCS_MOBILE_DAY_RULE,
  DOCS_ROLE_ACCESS,
  getDocsSection,
  isDocsSectionSlug,
  type DocsSectionSlug,
} from "@/lib/docs-guide";
import { DocsCallout, DocsChrome, DocsSteps } from "../DocsChrome";
import {
  DocsCalendarMock,
  DocsKanbanMock,
  DocsPhoneMock,
  DocsRolesTableMock,
  DocsWorkflowCanvasMock,
} from "../mocks/DocsVisualMocks";

export function generateStaticParams() {
  return [
    { slug: "inicio" },
    { slug: "roles" },
    { slug: "tareas" },
    { slug: "calendario" },
    { slug: "maquinas" },
    { slug: "checklists" },
    { slug: "solicitudes" },
    { slug: "flujos" },
    { slug: "movil" },
    { slug: "busqueda" },
  ];
}

function SectionBody({ slug }: { slug: DocsSectionSlug }) {
  switch (slug) {
    case "inicio":
      return (
        <>
          <p>
            MSA centraliza el mantenimiento preventivo y correctivo: máquinas,
            calendarios, checklists, tareas y solicitudes de piso. La interfaz
            está en español y la zona horaria de operación es{" "}
            <strong>America/Monterrey</strong> (Saltillo).
          </p>
          <div className="relative my-4 h-40 overflow-hidden rounded-xl border border-zinc-200 sm:h-52">
            <Image
              src="/docs/hero-msa.png"
              alt="Web y móvil de MSA"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 800px"
            />
          </div>
          <h3 className="text-base font-semibold text-zinc-900">Dos clientes, una API</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
            <li>
              <strong>Web</strong> — panel completo para administración, planeación
              y reportes.
            </li>
            <li>
              <strong>App Android</strong> — enfoque en tareas del día, checklist,
              fotos y notificaciones.
            </li>
          </ul>
        </>
      );
    case "roles":
      return (
        <>
          <p>
            Hay tres roles. El menú y las APIs se recortan según el rol: un
            técnico no ve el calendario ni las analíticas; Calidad se centra en
            checklists y revisiones.
          </p>
          <div className="relative my-4 h-36 overflow-hidden rounded-xl border border-zinc-200 sm:h-44">
            <Image
              src="/docs/roles.png"
              alt="Ilustración de roles"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 800px"
            />
          </div>
          <DocsRolesTableMock rows={DOCS_ROLE_ACCESS} />
          <DocsCallout title="Tip">
            Si alguien “no ve” una pantalla, casi siempre es el rol — no un bug
            de menú. Un admin puede invitarnos desde Usuarios.
          </DocsCallout>
        </>
      );
    case "tareas":
      return (
        <>
          <p>
            Las <strong>tareas</strong> (órdenes de trabajo) viven en{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">/tareas</code>{" "}
            como tablero por estatus: pendiente, en curso, completada y
            cancelada. Pueden ser rutinarias o bajo demanda; llevan folio,
            responsables, máquina, fechas y checklist embebido.
          </p>
          <DocsKanbanMock />
          <h3 className="mt-4 text-base font-semibold text-zinc-900">
            Fecha de inicio vs. inicio real
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
            <li>
              <strong>Fecha de inicio</strong> — cuándo debe mostrarse / planeada
              (también la usa la app móvil para filtrar).
            </li>
            <li>
              <strong>En curso</strong> — marca el momento en que el trabajo
              realmente arrancó (paro de máquina, duraciones).
            </li>
          </ul>
          <DocsCallout title="Al completar">
            Cuando una tarea pasa a completada, quien la creó recibe un aviso
            en la campana: «Tarea completada».
          </DocsCallout>
        </>
      );
    case "calendario":
      return (
        <>
          <p>
            El calendario agrupa eventos de mantenimiento preventivo. Puedes
            tener varios calendarios (por área o equipo). El predeterminado nace
            como <strong>Mantenimiento</strong>. Un administrador o un
            supervisor (rol Calidad) puede cambiarle el nombre; no se puede
            eliminar. La vista se refresca sola
            cada minuto si no tienes un diálogo abierto.
          </p>
          <DocsCalendarMock />
          <h3 className="mt-4 text-base font-semibold text-zinc-900">
            De evento a tarea
          </h3>
          <div className="relative my-3 h-36 overflow-hidden rounded-xl border border-zinc-200 sm:h-44">
            <Image
              src="/docs/flow-calendar-task.png"
              alt="Flujo de calendario a tarea"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 800px"
            />
          </div>
          <DocsSteps steps={DOCS_CALENDAR_TO_TASK_STEPS} />
          <DocsCallout title="Importante">
            La tarea queda ligada al evento por su descripción interna. En el
            calendario verás una marca de color según el estatus de esa tarea
            ese día.
          </DocsCallout>
        </>
      );
    case "maquinas":
      return (
        <>
          <p>
            En <strong>Máquinas</strong> organizas activos por <strong>área</strong>,
            subes fotos y documentos, revisas tareas y eventos ligados, y el
            paro acumulado.
          </p>
          <h3 className="text-base font-semibold text-zinc-900">
            Mantenimiento por horas de uso
          </h3>
          <p className="text-sm text-zinc-600">
            En el detalle de la máquina, el botón <strong>Mto. por horas</strong>{" "}
            abre un modal: indicas horas de uso por día, los días que trabaja la
            máquina y cada cuántas horas de uso hay que programar. MSA redondea
            horas ÷ horas por día y cuenta solo esos días al crear los eventos.
            Si marcas todos los días, el intervalo es de calendario; si no, los
            días apagados no suman horas.
          </p>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Ejemplo de muestra
            </p>
            <p className="mt-2 font-medium text-zinc-900">
              Mto. por horas — Prensa 1
            </p>
            <p className="text-zinc-600">
              Cada 250 h de uso (8 h/día) · Cada 31 días de trabajo (Lun, Mar,
              Mié, Jue, Vie)
            </p>
          </div>
        </>
      );
    case "checklists":
      return (
        <>
          <p>
            Las plantillas de checklist viven en carpetas. Al editarlas se
            genera una <strong>revisión propuesta</strong>; Calidad puede
            aprobar o rechazar antes de que rija el trabajo nuevo.
          </p>
          <DocsSteps steps={DOCS_CHECKLIST_REVISION_STEPS} />
          <DocsCallout title="En la tarea">
            Al crear o abrir una tarea con plantilla, los ítems se copian a la
            orden. Fotos y campos se guardan en la tarea, no en la plantilla.
          </DocsCallout>
        </>
      );
    case "solicitudes":
      return (
        <>
          <p>
            Cualquiera puede levantar una solicitud pública en{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">/orden</code>{" "}
            (sin iniciar sesión) y consultar el folio, o el email de contacto, en{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">/orden/consultar</code>.
            El equipo de mantenimiento la ve en Solicitudes y puede convertirla
            en tarea.
          </p>
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Ejemplo · folio de muestra
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-primary-700">
              MSA-2026-0042
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Estado: Recibida · Máquina: Horno HT-01 · «Ruido anormal en
              arranque»
            </p>
          </div>
        </>
      );
    case "flujos":
      return (
        <>
          <p>
            Los <strong>flujos</strong> (solo admin) automatizan avisos cuando
            pasa algo: tarea creada/completada/asignada, cambio de estatus,
            nota, solicitud pública o revisión de checklist. Las acciones son
            notificación en la app o correo (SMTP / Gmail).
          </p>
          <DocsWorkflowCanvasMock />
          <DocsCallout title="Probar">
            En cada acción del asistente hay un botón <strong>Probar</strong>:
            te manda el aviso o correo a ti con datos de ejemplo, sin registrar
            una corrida del flujo.
          </DocsCallout>
        </>
      );
    case "movil":
      return (
        <>
          <p>
            La app Expo/Android usa la misma API y sesión por cookie. Pantallas
            principales: login, tablero de tareas, detalle con checklist y
            adjuntos (cámara/galería), base de conocimiento, notificaciones y
            perfil. Los colores de estatus se sincronizan con la web.
          </p>
          <div className="my-4 flex justify-center">
            <DocsPhoneMock />
          </div>
          <DocsCallout title="Filtro del día">
            {DOCS_MOBILE_DAY_RULE}
          </DocsCallout>
          <h3 className="mt-4 text-base font-semibold text-zinc-900">
            Actualizaciones
          </h3>
          <p className="text-sm text-zinc-600">
            En Android la app puede detectar una APK nueva, descargarla con
            progreso e instalarla. Necesita permiso para instalar paquetes; el
            archivo se limpia después de instalar.
          </p>
        </>
      );
    case "busqueda":
      return (
        <>
          <p>
            El buscador del encabezado (y la página{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs">/buscar</code>)
            agrupa resultados: tareas, eventos, máquinas, checklists, personas
            y archivos — según lo que tu rol puede ver. Enter abre la página
            completa.
          </p>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-primary-100 bg-primary-50 px-4 py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-xs font-bold text-white">
                T
              </span>
              <p className="text-sm font-semibold text-zinc-900">Tareas</p>
              <span className="ml-auto rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-medium text-primary-800">
                2 resultados
              </span>
            </div>
            <ul className="divide-y divide-zinc-100 text-sm">
              <li className="px-4 py-3">
                <p className="font-medium text-zinc-900">Cambio de filtro HT-01</p>
                <p className="text-xs text-zinc-500">Folio 2041 · Pendiente</p>
              </li>
              <li className="px-4 py-3">
                <p className="font-medium text-zinc-900">Lubricación prensa 3</p>
                <p className="text-xs text-zinc-500">Folio 2038 · En curso</p>
              </li>
            </ul>
          </div>
          <p className="mt-3 text-sm text-zinc-600">
            En <strong>Equipo</strong> ves perfiles; en{" "}
            <strong>Base de conocimiento</strong> archivos de referencia para
            técnicos.
          </p>
        </>
      );
  }
}

export default async function DocumentacionSectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isDocsSectionSlug(slug)) notFound();
  const section = getDocsSection(slug);
  if (!section) notFound();

  return (
    <>
      <SetPageHeader title={section.title} subtitle="Documentación MSA" />
      <DocsChrome activeSlug={section.slug}>
        <article className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <header>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Guía de producto
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              {section.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{section.summary}</p>
          </header>
          <div className="prose-sm space-y-3 text-sm leading-relaxed text-zinc-700">
            <SectionBody slug={section.slug} />
          </div>
        </article>
      </DocsChrome>
    </>
  );
}
