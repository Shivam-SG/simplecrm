type Msg91FlowResponse = {
  type?: string
  message?: string
  [key: string]: unknown
}

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY

function buildRecipients(mobile: string, otp: string) {
  return [
    {
      mobiles: `91${mobile}`,
      phone: mobile,
      otp,
    },
  ]
}

export async function sendMsg91Otp(
  mobile: string,
  otp: string,
  templateId: string
): Promise<Msg91FlowResponse> {
  if (!MSG91_AUTH_KEY) {
    throw new Error("MSG91 auth key is not configured")
  }

  const response = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey: MSG91_AUTH_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      short_url: "1",
      short_url_expiry: "60",
      realTimeResponse: "1",
      recipients: buildRecipients(mobile, otp),
    }),
  })

  const data = (await response.json().catch(() => null)) as Msg91FlowResponse | null

  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : `MSG91 request failed with status ${response.status}`
    throw new Error(message)
  }

  return data ?? {}
}

export async function sendPasswordResetOtp(mobile: string, otp: string) {
  const templateId =
    process.env.MSG91_OTP_TEMPLATE_ID ??
    process.env.MSG91_SIGNIN_OTP_TEMPLATE ??
    process.env.MSG91_RESET_OTP_TEMPLATE

  if (!MSG91_AUTH_KEY || !templateId) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[MSG91] Missing auth key or template id; skipping SMS send")
      return null
    }

    throw new Error("MSG91 is not configured")
  }

  return sendMsg91Otp(mobile, otp, templateId)
}