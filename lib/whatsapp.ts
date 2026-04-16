const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

function isConfigured(): boolean {
  return !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);
}

async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  if (!isConfigured()) {
    console.log("[whatsapp] No configurado — mensaje omitido");
    return;
  }

  // Normalizar número argentino: quitar espacios, guiones, y agregar código país si falta
  let phone = to.replace(/[\s\-()]/g, "");
  if (phone.startsWith("0")) phone = phone.slice(1);
  if (!phone.startsWith("+") && !phone.startsWith("54")) {
    phone = "54" + phone;
  }
  if (phone.startsWith("+")) phone = phone.slice(1);

  const response = await fetch(
    `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error("[whatsapp] Error al enviar mensaje:", err);
  }
}

export async function sendPedidoListoWhatsApp(params: {
  clienteTel: string;
  clienteNombre: string | null;
  referencia: string;
  esRetiro: boolean;
}): Promise<void> {
  const nombre = params.clienteNombre ?? "cliente";

  const mensaje = params.esRetiro
    ? `Hola ${nombre}! 🎉\n\nTu pedido ${params.referencia} ya está listo para retirar en nuestro local.\n\n📍 Horarios de atención:\nLunes a viernes de 10 a 18hs\nSábados de 10 a 14hs\n\nInsumos Acuario`
    : `Hola ${nombre}! 🎉\n\nTu pedido ${params.referencia} terminó la preparación y será despachado a tu domicilio próximamente.\n\nTe avisaremos cuando sea enviado.\n\nInsumos Acuario`;

  await sendWhatsAppMessage(params.clienteTel, mensaje);
}
