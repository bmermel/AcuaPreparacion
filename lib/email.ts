import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? "onboarding@resend.dev";

export async function sendPedidoListoEmail(params: {
  clienteEmail: string;
  clienteNombre: string | null;
  referencia: string;
}): Promise<void> {
  const nombre = params.clienteNombre ?? "cliente";

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.clienteEmail,
    subject: `Tu pedido ${params.referencia} está listo para retirar`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1d4ed8; margin-bottom: 8px;">¡Tu pedido está listo! 🎉</h2>
        <p style="color: #374151; font-size: 16px;">Hola ${nombre},</p>
        <p style="color: #374151; font-size: 16px;">
          Te informamos que tu pedido <strong>${params.referencia}</strong> ya está listo para ser retirado en nuestro local.
        </p>
        <p style="color: #374151; font-size: 16px;">
          Podés pasar a retirarlo en nuestro horario de atención:<br/>
          <strong>Lunes a viernes de 10 a 18hs · Sábados de 10 a 14hs</strong>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 13px;">
          Insumos Acuario · insumosacuario.com.ar
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Error al enviar email de pedido listo:", error);
  }
}

export async function sendPedidoListoEnvioEmail(params: {
  clienteEmail: string;
  clienteNombre: string | null;
  referencia: string;
}): Promise<void> {
  const nombre = params.clienteNombre ?? "cliente";

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.clienteEmail,
    subject: `Tu pedido ${params.referencia} está listo y será despachado pronto`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1d4ed8; margin-bottom: 8px;">¡Tu pedido está listo! 🎉</h2>
        <p style="color: #374151; font-size: 16px;">Hola ${nombre},</p>
        <p style="color: #374151; font-size: 16px;">
          Te informamos que tu pedido <strong>${params.referencia}</strong> terminó la preparación y será despachado a la dirección indicada próximamente.
        </p>
        <p style="color: #374151; font-size: 16px;">
          Te avisaremos cuando sea enviado. Si tenés alguna consulta, no dudes en contactarnos.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 13px;">
          Insumos Acuario · insumosacuario.com.ar
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("[email] Error al enviar email de pedido listo (envío):", error);
  }
}
