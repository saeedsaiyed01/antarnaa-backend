import dotenv from "dotenv";
import twilio from "twilio";

dotenv.config();

const client = twilio(process.env.TWILIO_SID!, process.env.TWILIO_TOKEN!);

// Send OTP via SMS (You generate OTP, this just sends it)
export const sendOtp = async (
  number: string,
  otp: string,
  countryCode?: string
) => {
  return await client.messages.create({
    body: `Your Antarnaa OTP is ${otp}`,
    from: process.env.TWILIO_FROM!,
    to: `${countryCode || "+91"}${number}`,
  });
};

// Send WhatsApp message(not sending whatsapp meesage now)
export const sendWhatsapp = async (
  number: string,
  message: string,
  countryCode?: string
) => {
  const sanitizedNumber = number.replace(/\D/g, ""); // Remove non-digits
  if (sanitizedNumber.length !== 10) {
    throw new Error("Invalid mobile number");
  }
  return await client.messages.create({
    body: message,
    from: process.env.TWILIO_FROM!,
    to: `${countryCode || "+91"}${sanitizedNumber}`,
  });
};
