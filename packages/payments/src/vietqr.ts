/**
 * VietQR (NAPAS) dynamic QR payload builder — EMVCo Merchant-Presented QR
 * with the NAPAS beneficiary-organization extension (tag 38, GUID
 * A000000727, service code QRIBFTTA). Structure verified against the EMVCo
 * QR spec + independent NAPAS-based implementations before writing this file
 * (docs/DECISIONS.md — see M7 module notes).
 */

const CRC16_POLY = 0x1021;
const CRC16_INIT = 0xffff;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, no final XOR). */
export function crc16ccitt(input: string): string {
  let crc = CRC16_INIT;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ CRC16_POLY) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(tag: string, value: string): string {
  const len = String(value.length).padStart(2, "0");
  return `${tag}${len}${value}`;
}

const NAPAS_GUID = "A000000727";
const SERVICE_CODE = "QRIBFTTA";

export interface VietQrInput {
  bankBin: string;
  accountNo: string;
  /** Omit or 0 for a static (no-amount) QR. */
  amountVnd?: number;
  /** Additional data / transfer content (subtag 08), e.g. the order code. */
  content?: string;
}

export function buildVietQrPayload(input: VietQrInput): string {
  const beneficiaryOrg = tlv("00", input.bankBin) + tlv("01", input.accountNo);
  const merchantAccountInfo = tlv("00", NAPAS_GUID) + tlv("01", beneficiaryOrg) + tlv("02", SERVICE_CODE);
  const hasAmount = Boolean(input.amountVnd && input.amountVnd > 0);

  let payload =
    tlv("00", "01") + tlv("01", hasAmount ? "12" : "11") + tlv("38", merchantAccountInfo) + tlv("53", "704");

  if (hasAmount) {
    payload += tlv("54", String(input.amountVnd));
  }

  payload += tlv("58", "VN");

  if (input.content) {
    payload += tlv("62", tlv("08", input.content));
  }

  payload += "6304";
  return payload + crc16ccitt(payload);
}
