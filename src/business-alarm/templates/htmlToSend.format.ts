export function htmlToSend(
  data: Array<{
    school: {
      school_name: string;
      email?: string;
      client_id?: string;
      trustee_id?: string;
    }[];
    school_name: string;
    email?: string;
    client_id?: string;
    count: number;
  }>,
  message: string,
) {
  return `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f8fc; margin: 0; padding: 0;">
          <div style="max-width: 100vw; margin: 20px auto; background-color: #ffffff; padding: 20px; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #4a90e2; text-align: center; margin-bottom: 10px;">Duplicate Trustee Details</h2>
            <p style="font-size: 16px; color: #333333; text-align: center; margin-bottom: 20px;">
              The following trustees have duplicate <strong>${message}</strong>:
            </p>
            <p style="font-size: 14px; color: #555555; text-align: center; margin-bottom: 20px;">
              <strong>Total Count: ${data.length}</strong>
            </p>
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 20px;">
              <table style="border-collapse: collapse; width: 100%; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; min-width: 500px;">
                <thead>
                  <tr style="background-color: #4a90e2; color: #ffffff; text-align: left;">
                    <th style="padding: 12px; font-size: 14px;">Sr. No</th>
                    <th style="padding: 12px; font-size: 14px;">School Name</th>
                    <th style="padding: 12px; font-size: 14px;">
                     Email
                    </th>
                    <th style="padding: 12px; font-size: 14px;">Client ID</th>
                    <th style="padding: 12px; font-size: 14px;">Trustee_id</th>
                  </tr>
                </thead>
                <tbody>
                  ${data
                    .flatMap((trustee, index) =>
                      trustee.school.map(
                        (school, i) => `
                          <tr style="background-color: ${
                            i % 2 === 0 ? '#f9f9f9' : '#eaf3fc'
                          }; text-align: left;">
                            <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                              index + 1
                            }.${i + 1}</td>
                            <td style="padding: 12px; font-size: 14px; color: #333;">${
                              school.school_name
                            }</td>
                            <td style="padding: 12px; font-size: 14px; color: #333;">${
                              school?.email || 'N/A'
                            }</td>
                            <td style="padding: 12px; font-size: 14px; color: #333;">${
                              school?.client_id || 'N/A'
                            }</td>
                            <td style="padding: 12px; font-size: 14px; color: #333;">${school?.trustee_id}</td>
                          </tr>
                        `,
                      ),
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
            <p style="font-size: 14px; color: #555555; text-align: center; margin-top: 20px;">
              This email was auto-generated. Please do not reply.
            </p>
          </div>
        </body>
      </html>
    `;
}
export function refundAmountAndTransactionAmountMismatchTemplate(
  data: Array<{
    _id: string;
    order_id: string;
    transaction_amount: number;
    refund_amount: number;
    order_amount: number;
    trustee_id: string;
    school_id: string;
    status: string;
  }>,
) {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f8fc; margin: 0; padding: 0;">
        <div style="max-width:800px; margin: 20px auto; background-color: #ffffff; padding: 20px; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #e74c3c; text-align: center; margin-bottom: 10px;">Refund and Transaction Amount Mismatch</h2>
          <p style="font-size: 16px; color: #333333; text-align: center; margin-bottom: 20px;">
            Below is the list of <strong>mismatched records</strong>. Please review and take necessary actions.
          </p>
          <p style="font-size: 14px; color: #555555; text-align: center; margin-bottom: 20px;">
            <strong>Total Records with Issues: ${data.length}</strong>
          </p>
          <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 20px;">
            <table style="border-collapse: collapse; width: 100%; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; min-width: 800px;">
              <thead>
                <tr style="background-color: #e74c3c; color: #ffffff; text-align: left;">
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Sr. No</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Doc Id</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Order ID</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Order Amount</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Transaction Amount</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Refund Amount</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Trustee ID</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">School ID</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${data
                  .map((item, index) => {
                    return `
                      <tr style="background-color: ${
                        index % 2 === 0 ? '#f9f9f9' : '#eaf3fc'
                      }; text-align: left;">
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          index + 1
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item._id
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item.order_id
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item.order_amount
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #e74c3c; text-align: center;">${
                          item.transaction_amount
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #e74c3c; text-align: center;">${
                          item.refund_amount
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item.trustee_id
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item.school_id
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item.status
                        }</td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
          <p style="font-size: 14px; color: #555555; text-align: center; margin-top: 20px;">
            This email was auto-generated. Please review the mismatched records and take necessary actions.
          </p>
        </div>
      </body>
    </html>
  `;
}

export function Pg_keyMismatchTemplate(
  data: Array<{
    school_id: string;
    school_name: string;
    pg_key: string;
    trustee_id: string;
  }>,
) {
  return `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f8fc; margin: 0; padding: 0;">
        <div style="max-width:800px; margin: 20px auto; background-color: #ffffff; padding: 20px; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #e74c3c; text-align: center; margin-bottom: 10px;">PG Key Mismatch</h2>
          <p style="font-size: 16px; color: #333333; text-align: center; margin-bottom: 20px;">
            Below is the list of <strong>mismatched records</strong>. Please review and take necessary actions.
          </p>
          <p style="font-size: 14px; color: #555555; text-align: center; margin-bottom: 20px;">
            <strong>Total Records with Issues: ${data.length}</strong>
          </p>
          <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 20px;">
            <table style="border-collapse: collapse; width: 100%; background-color: #ffffff; border: 1px solid #ddd; border-radius: 8px; min-width: 800px;">
              <thead>
                <tr style="background-color: #e74c3c; color: #ffffff; text-align: left;">
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Sr. No</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">School Id</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">Trustee Id</th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">School Name </th>
                  <th style="padding: 12px; font-size: 14px; text-align: center;">PG Key</th>
                </tr>
              </thead>
              <tbody>
                ${data
                  .map((item, index) => {
                    return `
                      <tr style="background-color: ${
                        index % 2 === 0 ? '#f9f9f9' : '#eaf3fc'
                      }; text-align: left;">
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          index + 1
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item.school_id
                        }</td>
                         <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                           item.trustee_id
                         }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item.school_name
                        }</td>
                        <td style="padding: 12px; font-size: 14px; color: #333; text-align: center;">${
                          item.pg_key
                        }
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
          <p style="font-size: 14px; color: #555555; text-align: center; margin-top: 20px;">
            This email was auto-generated. Please review the mismatched records and take necessary actions.
          </p>
        </div>
      </body>
    </html>
  `;
}
