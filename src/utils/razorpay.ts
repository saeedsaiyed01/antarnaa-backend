// src/utils/razorpay.ts
import Razorpay from "razorpay";
import crypto from "crypto";

const isDev = process.env.NODE_ENV === "development";

const razor = new Razorpay({
  key_id: isDev ? process.env.RAZORPAY_DEV_KEY! : process.env.RAZORPAY_KEY!,
  key_secret: isDev
    ? process.env.RAZORPAY_DEV_SECRET!
    : process.env.RAZORPAY_SECRET!,
});

export const createPayment = async (amount: number, currency: string) => {
  return await razor.orders.create({ amount, currency });
};

export const verifySignature = (data: any) => {
  const hmac = crypto
    .createHmac(
      "sha256",
      isDev ? process.env.RAZORPAY_DEV_SECRET! : process.env.RAZORPAY_SECRET!
    )
    .update(`${data.razorpay_order_id}|${data.razorpay_payment_id}`)
    .digest("hex");
  return hmac === data.razorpay_signature;
};
