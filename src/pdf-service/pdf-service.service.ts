import { Injectable } from '@nestjs/common';

import * as words from 'number-to-words';

@Injectable()
export class PdfService {
  private numberToWords(num: number): string {
    return (
      words.toWords(num).replace(/\b\w/g, (char) => char.toUpperCase()) +
      ' Rupees Only.'
    );
  }

  async generatePDF(data: any): Promise<Buffer> {
    var pdfMake = require('pdfmake/build/pdfmake');
    var pdfFonts = require('pdfmake/build/vfs_fonts');
    pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;
    const getValue = (value: any) =>
      value === '' || value === undefined ? 'NA' : value;
    return new Promise((resolve, reject) => {
      const docDefinition = {
        content: [
          { text: 'Payment Invoice', style: 'header' },
          {
            text: `Date: ${getValue(
              new Date(data.date).toLocaleDateString('en-IN', {
                timeZone: 'Asia/Kolkata',
              }),
            )}`,
            style: 'date',
          },
          {
            text: `Transaction ID: ${getValue(data.transactionId)}`,
            style: 'info',
          },
          {
            text: `Custom Order ID: ${getValue(data.custom_order_id)}`,
            style: 'info',
          },
          {
            text: `Dispute Status: ${getValue(data.disputeStatus)}`,
            style: 'info',
          },
          { text: `School: ${getValue(data.schoolName)}`, style: 'subheader' },
          {
            text: `Receipt No: ${getValue(
              data.student_details?.student_details?.receipt,
            )}`,
            style: 'info',
          },
          {
            table: {
              headerRows: 1,
              widths: ['40%', '60%'],
              body: [
                [
                  {
                    text: 'Student Details',
                    style: 'tableHeader',
                    colSpan: 2,
                    alignment: 'center',
                  },
                  {},
                ],
                [
                  'Name',
                  getValue(data.student_details?.student_details?.student_name),
                ],
                [
                  'Student ID',
                  getValue(data.student_details?.student_details?.student_id),
                ],
                [
                  'Email',
                  getValue(
                    data.student_details?.student_details?.student_email,
                  ),
                ],
                [
                  'Phone',
                  getValue(
                    data.student_details?.student_details?.student_phone_no,
                  ),
                ],
                [
                  'Unique ID',
                  getValue(data.student_details?.additional_fields?.uid),
                ],
              ],
            },
            style: 'table',
          },
          {
            table: {
              headerRows: 1,
              widths: ['50%', '50%'],
              body: [
                [
                  { text: 'Amount (INR)', style: 'tableHeader' },
                  { text: 'Payment Method', style: 'tableHeader' },
                ],
                [`₹${getValue(data.amount)}`, getValue(data.payment_method)],
              ],
            },
            style: 'table',
          },
          {
            text: `Bank Reference: ${getValue(data.bank_reference)}`,
            style: 'info',
          },
          { text: `Payment Gateway: ${getValue(data.gateway)}`, style: 'info' },
          {
            text: `UPI ID: ${getValue(data.details?.upi?.upi_id)}`,
            style: 'info',
          },
          { text: `Amount Paid: ₹${getValue(data.amount)}`, style: 'total' },
          {
            text: 'Thank you for your payment. If you have any queries, please contact us.',
            style: 'footer',
          },
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            alignment: 'center',
            margin: [0, 0, 0, 20],
          },
          subheader: { fontSize: 16, bold: true, margin: [0, 10, 0, 10] },
          date: { fontSize: 12, margin: [0, 0, 0, 10] },
          info: { fontSize: 12, margin: [0, 5, 0, 5] },
          table: { margin: [0, 10, 0, 20] },
          tableHeader: {
            bold: true,
            fillColor: '#eeeeee',
            alignment: 'center',
          },
          total: { fontSize: 14, bold: true, margin: [0, 10, 0, 10] },
          footer: { fontSize: 12, italics: true, margin: [0, 10, 0, 5] },
        },
      } as any;

      const pdfDoc = pdfMake.createPdf(docDefinition);

      pdfDoc.getBuffer((buffer) => {
        if (buffer) {
          console.log('PDF Generated: invoice.pdf');
          resolve(buffer);
        } else {
          reject(new Error('Failed to generate PDF buffer'));
        }
      });
    });
  }

  async generateInvoicePdf(invoiceData: any): Promise<Buffer> {
    var pdfMake = require('pdfmake/build/pdfmake');
    var pdfFonts = require('pdfmake/build/vfs_fonts');
    pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts;
    return new Promise((resolve, reject) => {
      const docDefinition = {
        content: [
          {
            canvas: [
              { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 },
            ],
          },
          {
            text: 'Tax Invoice',
            style: 'header',
            alignment: 'center',
            color: '#000000',
          },
          {
            layout: 'noBorders',
            table: {
              widths: ['33%', '33%', '33%'],
              body: [
                [
                  {
                    text: 'Seller Details',
                    fontSize: 9,
                    color: '#4b5563',
                    margin: [0, 2],
                  },
                  {
                    text: 'Buyer Details',
                    fontSize: 9,
                    color: '#4b5563',
                    margin: [0, 2],
                  },
                  {
                    text: 'Invoice Details',
                    fontSize: 9,
                    color: '#4b5563',
                    margin: [0, 2],
                  },
                ],
                [
                  {
                    text: [
                      {
                        text: `${invoiceData.sellerDetails.name}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: `${invoiceData.sellerDetails.gstIn}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: `${invoiceData.sellerDetails.residence_state}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: 'Bank Details:\n',
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: `Account Holder Name: ${invoiceData.sellerDetails.account_holder_name}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: `Account Number: ${invoiceData.sellerDetails.account_number}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: `IFSC: ${invoiceData.sellerDetails.ifsc_code}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                    ],
                  },
                  {
                    text: [
                      {
                        text: `${invoiceData.buyerDetails.name}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: `GSTIN: ${invoiceData.sellerDetails.gstIn}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: `Place of Supply: ${invoiceData.buyerDetails.placeOfSupply}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                    ],
                  },
                  {
                    text: [
                      {
                        text: `Invoice Date: ${invoiceData.invoiceDate}\n`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                      { text: '\n', fontSize: 4 },
                      {
                        text: `Invoice No: ${invoiceData.invoiceNumber}`,
                        fontSize: 8,
                        color: '#9ca3af',
                      },
                    ],
                  },
                ],
              ],
            },
            margin: [0, 0, 0, 10],
          },
          {
            text: '\nSelect Commissions',
            style: 'subheader',
            color: '#000000',
          },
          {
            layout: 'noBorders',
            table: {
              headerRows: 1,
              widths: ['*', '*', '*', '*'],
              body: [
                [
                  {
                    text: 'Commission Period',
                    fillColor: '#F2F2F2',
                    color: '#4b5563',
                    fontSize: 9,
                    margin: 5,
                  },
                  {
                    text: 'HSN/SAC',
                    fillColor: '#F2F2F2',
                    color: '#4b5563',
                    fontSize: 9,
                    margin: 5,
                  },
                  {
                    text: 'Commission Amount',
                    fillColor: '#F2F2F2',
                    color: '#4b5563',
                    fontSize: 9,
                    margin: 5,
                  },
                  {
                    text: 'Tax',
                    fillColor: '#F2F2F2',
                    color: '#4b5563',
                    fontSize: 9,
                    margin: 5,
                  },
                ],
                [
                  {
                    text: invoiceData.month,
                    fontSize: 8,
                    color: '#333333',
                    margin: 5,
                  },
                  {
                    text: invoiceData.hsn,
                    fontSize: 8,
                    color: '#333333',
                    margin: 5,
                  },
                  {
                    text: `₹${invoiceData.details?.amount_without_gst}`,
                    fontSize: 8,
                    color: '#333333',
                    margin: 5,
                  },
                  {
                    text: invoiceData.details.tax,
                    fontSize: 8,
                    color: '#333333',
                    margin: 5,
                  },
                ],
              ],
            },
          },

          {
            text: `\nTotal Amount in Words: ${invoiceData.amountInWords}`,
            italics: true,
            fontSize: 9,
          },

          {
            columns: [
              { text: '' },
              {
                text: [
                  {
                    text: `Subtotal: ₹${invoiceData.details?.amount_with_gst}\n`,
                    fontSize: 8,
                    color: '#666666',
                    alignment: 'right',
                  },
                  { text: '\n', fontSize: 4 },
                  {
                    text: `IGST@18%: ₹${invoiceData.details.tax}\n`,
                    fontSize: 8,
                    color: '#666666',
                    alignment: 'right',
                  },
                  { text: '\n', fontSize: 4 },
                  {
                    text: `Total Amount: ₹${invoiceData.details?.total}`,
                    bold: true,
                    fontSize: 10,
                    color: '#000000',
                  },
                ],
                alignment: 'right',
              },
            ],
          },

          { text: '\n', margin: [0, 10, 0, 0] },
          {
            table: {
              widths: ['100%'],
              body: [
                [
                  {
                    text: invoiceData.note,
                    fillColor: '#EDEDED',
                    color: '#4b5563',
                    fontSize: 8,
                    alignment: 'start',
                    margin: [10, 5, 0, 5],
                    height: 198,
                  },
                ],
              ],
            },
            layout: 'noBorders',
            margin: [0, 5, 0, 5],
          },
          { text: '\n', margin: [0, 10, 0, 0] },
          {
            canvas: [
              { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 },
            ],
          },
        ],

        styles: {
          header: { fontSize: 14, bold: true, margin: [0, 10] },
          subheader: { fontSize: 12, bold: true, margin: [0, 10] },
        },
      } as any;
      const pdfDoc = pdfMake.createPdf(docDefinition);

      pdfDoc.getBuffer((buffer) => {
        if (buffer) {
          console.log('PDF Generated: invoice.pdf');
          resolve(buffer);
        } else {
          reject(new Error('Failed to generate PDF buffer'));
        }
      });
    });
  }
}
