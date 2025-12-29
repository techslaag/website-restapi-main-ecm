import { Currency } from "@prisma/client";
import PDFDocument from "pdfkit";
import { serializeError } from "serialize-error";
import IPaymentReceipt from "../../interfaces/IPaymentReceipt";
import { formatAmountCurrency } from "../utils/currencyFormat";

function generatePaymentReceipt(receipt: IPaymentReceipt) {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      let doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Author: process.env.NEXT_PUBLIC_APP_NAME,
          CreationDate: receipt.date,
          Creator: process.env.NEXT_PUBLIC_APP_NAME,
        },
      });

      generateHeader(doc);
      generateCustomerInformation(doc, receipt);
      generatePaymentReceiptTable(doc, receipt);
      generateFooter(doc);

      doc.end();

      const buffers: Buffer[] = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });
    } catch (error) {
      reject(serializeError(error));
    }
  });
}

function generateHeader(doc: PDFKit.PDFDocument) {
  doc
    .image(`public/logo.png`, 50, 45, { width: 175 })
    .fillColor("#444444")
    .fontSize(10)
    .text("EcoMatin SRL", 200, 50, { align: "right" })
    .text("Avenue Louise 523, Bruxelles", 200, 65, { align: "right" })
    .text("BE 1003413035", 200, 80, { align: "right" })
    .moveDown();
}

function generateCustomerInformation(
  doc: PDFKit.PDFDocument,
  receipt: IPaymentReceipt,
) {
  doc.fillColor("#444444").fontSize(20).text("Facture", 50, 160);

  generateHr(doc, 185);

  const customerInformationTop = 200;

  doc
    .fontSize(10)
    .text("Numéro facture:", 50, customerInformationTop)
    .font("Helvetica-Bold")
    .text(receipt.receiptNumber, 150, customerInformationTop)
    .font("Helvetica")
    .text("Date:", 50, customerInformationTop + 15)
    .text(formatDate(new Date()), 150, customerInformationTop + 15)

    .font("Helvetica-Bold")
    .text(receipt.shipping.name, 300, customerInformationTop)
    .font("Helvetica")
    .text(receipt.shipping.email, 300, customerInformationTop + 15);

  if (receipt.shipping.address) {
    doc.text(receipt.shipping.address, 300, customerInformationTop + 15);
  }

  const location = [
    receipt.shipping.city,
    receipt.shipping.state,
    receipt.shipping.country,
  ].filter((item) => !!item);
  if (location.length !== 0) {
    doc.text(location.join(", "), 300, customerInformationTop + 30);
  }

  doc.moveDown();

  generateHr(doc, 252);
}

function calculateTva(percentage: number, amount: number) {
  return amount - Number(amount / (Number(100 + percentage) / 100));
}

function generatePaymentReceiptTable(
  doc: PDFKit.PDFDocument,
  receipt: IPaymentReceipt,
) {
  let i;
  const receiptTableTop = 330;

  // tva value
  const tva = calculateTva(
    Number(process.env.TVA_PERCENTAGE ?? 21),
    receipt.subtotal,
  );

  doc.font("Helvetica-Bold");
  generateTableRow(
    doc,
    receiptTableTop,
    "Reférence",
    "Description",
    "Prix unitaire",
    "Quantité",
    "Total",
  );
  generateHr(doc, receiptTableTop + 20);
  doc.font("Helvetica");

  let position: number = receiptTableTop + 30;

  for (i = 0; i < receipt.items.length; i++) {
    const item = receipt.items[i];

    // deducted amount
    const withoutTva = Number(item.amount / 1.21);
    // position = receiptTableTop + (i + 1) * 30;
    position = generateTableRow(
      doc,
      position,
      item.item,
      item.description,
      formatCurrency(receipt.currency, withoutTva / item.quantity),
      item.quantity.toString(),
      formatCurrency(receipt.currency, withoutTva),
    );

    generateHr(doc, position + 10);
  }

  // const subtotalPosition = receiptTableTop + (i + 1) * 30;
  position = generateTableRow(
    doc,
    position + 20,
    "",
    "",
    "TVA (21%)",
    "",
    formatCurrency(receipt.currency, tva),
  );

  // const subtotalPosition = receiptTableTop + (i + 1) * 30;
  position = generateTableRow(
    doc,
    position,
    "",
    "",
    "Total TTC",
    "",
    formatCurrency(receipt.currency, receipt.subtotal),
  );

  // const paidToDatePosition = subtotalPosition + 20;
  position = generateTableRow(
    doc,
    position,
    "",
    "",
    "Payé à ce jour",
    "",
    formatCurrency(receipt.currency, receipt.paid),
  );

  doc.font("Helvetica-Bold");
  position = generateTableRow(
    doc,
    position,
    "",
    "",
    "Reste à payer",
    "",
    formatCurrency(receipt.currency, receipt.subtotal - receipt.paid),
  );
  doc.font("Helvetica");
}

function generateFooter(doc: PDFKit.PDFDocument) {
  doc.fontSize(10).text("Nous vous remercions de votre confiance", 50, 780, {
    align: "center",
    width: 500,
  });
}

function generateTableRow(
  doc: PDFKit.PDFDocument,
  y: number,
  item: string,
  description: string,
  unitCost: string,
  quantity: string,
  lineTotal: string,
) {
  const textHeight = doc.heightOfString(description, {
    lineBreak: true,
    align: "left",
    width: 112,
  });
  doc
    .fontSize(10)
    .text(item, 50, y)
    .text(description, 180, y, {
      lineBreak: true,
      align: "left",
      width: 112,
      height: Math.ceil(textHeight),
    })
    .text(unitCost, 280, y, { width: 90, align: "right" })
    .text(quantity, 370, y, { width: 90, align: "right" })
    .text(lineTotal, 0, y, { align: "right" });
  return Number(textHeight < 24 ? 24 + y : textHeight + y);
}

function generateHr(doc: PDFKit.PDFDocument, y: number) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}

function formatCurrency(currency: Currency, amount: number) {
  return formatAmountCurrency(amount, currency);
}

function formatDate(date: Date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export default generatePaymentReceipt;
