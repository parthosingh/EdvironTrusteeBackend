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

export function generateSettlementFaildEmail(
  schools: {
    school_id: string;
    school_name: string;
    school_email: string;
    school_phone_number: string;
    client_id: string;
    settlements: {
      _id: string;
      vendor_id: string;
      vendor_name: string;
      settlement_id: string;
      settled_on: string;
      utr: string;
      adjustment: number;
      vendor_transaction_amount: number;
      net_settlement_amount: number;
      status: string;
      payment_from: Date;
      payment_till: Date;
    }[];
  }[],
  title: string,
  subTitle: string,
  color_scheme: string,
): string {
  const headerColor = color_scheme === 'error' ? '#e74c3c' : '#2c3e50';
  return `
    <html>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
        <div style="max-width: 100%; margin: auto; padding: 20px;">
          <h2 style="color: ${headerColor}; text-align: center;">${title}</h2>
          <p style="text-align: center; font-size: 14px; color: #555;">${subTitle}</p>
          ${schools
            .map(
              (school) => `
            <div style="padding: 10px; margin: 10px 0; border-bottom: 2px solid #ccc;">
              <h3 style="color: ${headerColor};">School Name: ${
                school.school_name
              }</h3>
              <p style="color: #555;">Email: ${school.school_email} | Phone: ${
                school.school_phone_number
              } | Client ID: ${school.client_id} | School ID: ${
                school.school_id
              }</p>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; min-width: 800px;">
                  <thead>
                    <tr style="background-color: ${headerColor}; color: white;">
                      <th style="padding: 8px; border: 1px solid #ddd;">Vendor Name</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Settlement ID</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Settled On</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Status</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">UTR</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Vendor Transaction Amount</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Net Settlement Amount</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Adjustment</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Payment From</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Payment Till</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${school.settlements
                      .map(
                        (settlement) => `
                      <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.vendor_name || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.settlement_id || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          new Date(settlement.settled_on).toLocaleString(
                            'en-US',
                            {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          ) || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.status || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.utr || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.vendor_transaction_amount || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.net_settlement_amount || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.adjustment || 'N/A'
                        }</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${
                            new Date(settlement.payment_from).toLocaleString(
                              'en-US',
                              {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            ) || 'N/A'
                          }</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${
                            new Date(settlement.payment_till).toLocaleString(
                              'en-US',
                              {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            ) || 'N/A'
                          } </td>
                      </tr>
                    `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `,
            )
            .join('')}
          <p style="text-align: center; font-size: 14px; color: #555; margin-top: 20px;">
            This email was auto-generated. Please review the records and take necessary actions.
          </p>
        </div>
      </body>
    </html>`;
}

export function checkMerchantSettlementnot(missMatched) {
  // console.log(missMatched)
  return `
  <html>
<head>
  <meta charset="UTF-8">
  <title>Merchant Settlement Report</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px;">

  <div style=" margin: auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h2 style="text-align: center; color: #2563eb;">📊 Merchant Settlement Report</h2>
    <p style="font-size: 16px; color: #333333; text-align: center; margin-bottom: 20px;">
      <strong>Total School : ${missMatched.length}</strong>
    </p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      <thead>
        <tr style="background-color: #2563eb; color: white;">
          <th style="padding: 10px; border: 1px solid #e5e7eb; width: 10%;">Sr. No</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; width: 40%; ">School Name</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb;" width: 20%; >School ID</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb;" width: 20%; >Email</th>
        </tr>
      </thead>
      <tbody>
            ${missMatched
              .map(
                (school) => `
          <tr style="background-color: #f9fafb; color: #1f2937;">
            <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${
              missMatched.indexOf(school) + 1
            }</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb; white-space: normal;">${
              school.school_name
            }</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${
              school.school_id
            }</td>
            <td style="padding: 10px; border: 1px solid #e5e7eb;">${
              school.email || 'N/A'
            }</td>
          </tr>
        `,
              )
              .join('')}
      </tbody>
    </table>

    <p style="margin-top: 20px; font-size: 14px; color: #4b5563;">This is an automated report generated for merchant settlements.</p>
  </div>

</body>
</html>
  `;
}

export function generateZeroSettlementEmail(
  schools: {
    school_id: string;
    school_name: string;
    school_email: string;
    school_phone_number: string;
    client_id: string;
    vendor: {
      _id: string;
      client_id: string;
      name: string;
      email: string;
      phone: string;
      status: string;
      vendor_id: string;
    }[];
  }[],
  title: string,
  subTitle: string,
  color_scheme: string,
): string {
  const headerColor = color_scheme === 'error' ? '#e74c3c' : '#2c3e50';
  return `
    <html>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
        <div style="max-width: 100%; margin: auto; padding: 20px;">
          <h2 style="color: ${headerColor}; text-align: center;">${title}</h2>
          <p style="text-align: center; font-size: 14px; color: #555;">${subTitle}</p>
          ${schools
            .map(
              (school) => `
            <div style="padding: 10px; margin: 10px 0; border-bottom: 2px solid #ccc;">
              <h3 style="color: ${headerColor};">School Name: ${
                school.school_name
              }</h3>
              <p style="color: #555;">Email: ${school.school_email} | Phone: ${
                school.school_phone_number
              } | Client ID: ${school.client_id} | School ID: ${
                school.school_id
              }</p>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; min-width: 800px;">
                  <thead>
                    <tr style="background-color: ${headerColor}; color: white;">
                      <th style="padding: 8px; border: 1px solid #ddd;">Vendor Name</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">ID</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Status</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Email</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Phone</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Vendor Id</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${school.vendor
                      .map(
                        (v) => `
                      <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          v.name || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          v._id || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          v.status || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          v.email || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          v.phone || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          v.vendor_id || 'N/A'
                        }</td>
                      </tr>
                    `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
      </body>
    </html>`;
}

export function generateSettlementEmail(
  schools: {
    school_id: string;
    school_name: string;
    school_email: string;
    school_phone_number: string;
    client_id: string;
    settlements: {
      _id: string;
      vendor_id: string;
      vendor_name: string;
      settlement_id: string;
      settled_on: string;
      utr: string;
      adjustment: number;
      vendor_transaction_amount: number;
      net_settlement_amount: number;
      status: string;
      payment_from: Date;
      payment_till: Date;
    }[];
  }[],
  title: string,
  subTitle: string,
  color_scheme: string,
): string {
  const headerColor = color_scheme === 'error' ? '#e74c3c' : '#2c3e50';
  return `
    <html>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
        <div style="max-width: 100%; margin: auto; padding: 20px;">
          <h2 style="color: ${headerColor}; text-align: center;">${title}</h2>
          <p style="text-align: center; font-size: 14px; color: #555;">${subTitle}</p>
          ${schools
            .map(
              (school) => `
            <div style="padding: 10px; margin: 10px 0; border-bottom: 2px solid #ccc;">
              <h3 style="color: ${headerColor};">School Name: ${
                school.school_name
              }</h3>
              <p style="color: #555;">Email: ${school.school_email} | Phone: ${
                school.school_phone_number
              } | Client ID: ${school.client_id} | School ID: ${
                school.school_id
              }</p>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; min-width: 800px;">
                  <thead>
                    <tr style="background-color: ${headerColor}; color: white;">
                      <th style="padding: 8px; border: 1px solid #ddd;">Vendor Name</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Settlement ID</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Settled On</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Status</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">UTR</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Vendor Transaction Amount</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Net Settlement Amount</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Adjustment</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Payment From</th>
                      <th style="padding: 8px; border: 1px solid #ddd;">Payment Till</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${school.settlements
                      .map(
                        (settlement) => `
                      <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.vendor_name || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.settlement_id || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          new Date(settlement.settled_on).toLocaleString(
                            'en-US',
                            {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          ) || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.status || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.utr || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.vendor_transaction_amount || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.net_settlement_amount || 'N/A'
                        }</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${
                          settlement.adjustment || 'N/A'
                        }</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${
                            new Date(settlement.payment_from).toLocaleString(
                              'en-US',
                              {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            ) || 'N/A'
                          }</td>
                          <td style="padding: 8px; border: 1px solid #ddd;">${
                            new Date(settlement.payment_till).toLocaleString(
                              'en-US',
                              {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            ) || 'N/A'
                          } </td>
                      </tr>
                    `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `,
            )
            .join('')}
          <p style="text-align: center; font-size: 14px; color: #555; margin-top: 20px;">
            This email was auto-generated. Please review the records and take necessary actions.
          </p>
        </div>
      </body>
    </html>`;
}

export function generateTransactionMailReciept(
  amount: string,
  gateway: string,
  additional_data: any,
  school_id: string,
  trustee_id: string,
  custom_order_id: string,
  vendors_info: string,
  isQRPayment: string,
  createdAt: string,
  updatedAt: string,
  collect_id: string,
  status: string,
  bank_reference: string,
  details: string,
  transactionAmount: string,
  transactionStatus: string,
  transactionTime: string,
  payment_method: string,
  payment_time: string,
  transaction_amount: string,
  order_amount: string,
  isAutoRefund: string,
  reason: string,
  error_details: string,
) {
  interface StudentDetails {
    student_name?: string;
    student_id?: string;
    student_email?: string;
    student_phone_no?: string;
  }
  let student: StudentDetails = {};
  try {
    if (typeof additional_data === 'string') {
      const parsed = JSON.parse(additional_data);
      student = parsed?.student_details || {};
    } else if (
      typeof additional_data === 'object' &&
      additional_data !== null
    ) {
      student = additional_data?.student_details || {};
    }
  } catch (e) {
    student = {};
  }

  const bankDetails = JSON.parse(details);

  // Determine bank/provider/upi_id based on payment method
  let bankOrProvider = 'NA';
  let bankOrProviderLabel = 'Bank';
  if (payment_method === 'net_banking') {
    bankOrProviderLabel = 'Bank';
    if (bankDetails?.netbanking?.netbanking_bank_name) {
      bankOrProvider = bankDetails.netbanking.netbanking_bank_name;
    }
  } else if (payment_method === 'upi') {
    bankOrProviderLabel = 'UPI ID';
    if (bankDetails?.upi?.upi_id) {
      bankOrProvider = bankDetails.upi.upi_id;
    }
  } else if (payment_method === 'wallet') {
    bankOrProviderLabel = 'Provider';
    if (bankDetails?.app?.provider) {
      bankOrProvider = bankDetails.app.provider;
    }
  } else if (
    payment_method === 'credit_card' ||
    payment_method === 'debit_Card'
  ) {
    bankOrProviderLabel = 'Bank';
    if (bankDetails?.card?.card_bank_name) {
      bankOrProvider = bankDetails.card.card_bank_name;
    }
  }

  // Format transactionTime to remove 'T' and 'Z'
  let formattedTransactionTime = transactionTime;
  if (
    formattedTransactionTime &&
    typeof formattedTransactionTime === 'string'
  ) {
    formattedTransactionTime = formattedTransactionTime
      .replace('T', ' ')
      .replace('Z', '');
  }

  return `
<div style="max-width:700px;margin:0 auto;padding:20px;font-family:sans-serif;background:#f9fafb;">
  <h2 style="color:#111827;font-size:24px;margin-bottom:20px;">Payment details</h2>

  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">

    <div style="margin-bottom: 16px;">
      <div style="margin-bottom: 8px;">
        <strong>Order ID:</strong> ${custom_order_id || collect_id}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Order Amount:</strong> ₹${amount}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Status:</strong>
        <span style="color: ${
          status.toUpperCase() === 'SUCCESS'
            ? '#10b981'
            : status === 'PENDING'
              ? '#f59e0b'
              : '#ef4444'
        };">
          ${status.toUpperCase()}
        </span>
      </div>
    </div>

    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;"><strong>Payment method:</strong></td>
        <td>${payment_method || 'NA'}</td>
        <td style="padding:6px 0;"><strong>Transaction amount:</strong></td>
        <td>₹${transaction_amount || 'NA'}</td>
      </tr>
      <tr>
       <td style="padding:6px 0;"><strong>Transaction Time</strong></td>
        <td>${formattedTransactionTime || 'NA'}</td>

        <td><strong>${bankOrProviderLabel}:</strong></td>
        <td>${bankOrProvider}</td>
      </tr>
      <tr>
       <td><strong>Reason:</strong></td>
        <td>${reason || 'NA'}</td>
        <td><strong>Bank reference number:</strong></td>
        <td>${bank_reference || 'NA'}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Currency:</strong></td>
        <td>INR</td>
        <td><strong>Edviron Order ID:</strong></td>
        <td>${collect_id || 'NA'}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Merchant Order ID:</strong></td>
        <td>${custom_order_id || 'NA'}</td>
        <td><strong>Remarks:</strong></td>
        <td>${status}</td>
      </tr>
      </tr>
    </table>
  </div>

  <h3 style="color:#111827;font-size:20px;margin-bottom:12px;">User details</h3>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;"><strong>Student name:</strong></td>
        <td>${student?.student_name || 'NA'}</td>
        <td><strong>Student Enrollment ID:</strong></td>
        <td>${student?.student_id || 'NA'}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Email:</strong></td>
        <td>${student?.student_email || 'NA'}</td>
        <td><strong>Phone number:</strong></td>
        <td>${student?.student_phone_no || 'NA'}</td>
    </table>
  </div>
</div>
        `;
}

export async function generateRefundMailReciept(
  data: any,
  school_name: string,
  refund_amount: string,
  order_id: string,
  status: string,
  refund_id: string,
  refund_initiated: string,
  refund_remark: string,
  splitDetail: any,
  refund_reason: string,
) {
  const {
    amount,
    gateway,
    additional_data,
    school_id,
    trustee_id,
    custom_order_id,
    vendors_info,
    isQRPayment,
    createdAt,
    updatedAt,
    collect_id,
    bank_reference,
    details,
    transactionAmount,
    transactionStatus,
    transactionTime,
    payment_method,
    payment_time,
    transaction_amount,
    order_amount,
    isAutoRefund,
    reason,
    error_details,
  } = data;
  interface StudentDetails {
    student_name?: string;
    student_id?: string;
    student_email?: string;
    student_phone_no?: string;
  }
  let student: StudentDetails = {};
  try {
    if (typeof additional_data === 'string') {
      const parsed = JSON.parse(additional_data);
      student = parsed?.student_details || {};
    } else if (
      typeof additional_data === 'object' &&
      additional_data !== null
    ) {
      student = additional_data?.student_details || {};
    }
  } catch (e) {
    student = {};
  }

  const bankDetails = JSON.parse(details);

  // Determine bank/provider/upi_id based on payment method
  let bankOrProvider = 'NA';
  let bankOrProviderLabel = 'Bank';
  if (payment_method === 'net_banking') {
    bankOrProviderLabel = 'Bank';
    if (bankDetails?.netbanking?.netbanking_bank_name) {
      bankOrProvider = bankDetails.netbanking.netbanking_bank_name;
    }
  } else if (payment_method === 'upi') {
    bankOrProviderLabel = 'UPI ID';
    if (bankDetails?.upi?.upi_id) {
      bankOrProvider = bankDetails.upi.upi_id;
    }
  } else if (payment_method === 'wallet') {
    bankOrProviderLabel = 'Provider';
    if (bankDetails?.app?.provider) {
      bankOrProvider = bankDetails.app.provider;
    }
  } else if (
    payment_method === 'credit_card' ||
    payment_method === 'debit_Card'
  ) {
    bankOrProviderLabel = 'Bank';
    if (bankDetails?.card?.card_bank_name) {
      bankOrProvider = bankDetails.card.card_bank_name;
    }
  }

  // Format transactionTime to remove 'T' and 'Z'
  let formattedTransactionTime = transactionTime;
  if (
    formattedTransactionTime &&
    typeof formattedTransactionTime === 'string'
  ) {
    formattedTransactionTime = formattedTransactionTime
      .replace('T', ' ')
      .replace('Z', '');
  }

  return `
<div style="max-width:700px;margin:0 auto;padding:20px;font-family:sans-serif;background:#f9fafb;">
  <h2 style="color:#111827;font-size:24px;margin-bottom:20px;">Refund details</h2>

  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">

    <div style="margin-bottom: 16px;">
      <div style="margin-bottom: 8px;">
        <strong>Order ID:</strong> ${custom_order_id || collect_id}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Order Amount:</strong> ₹${amount}
      </div>
      <div style="margin-bottom: 8px;">
        <strong>Refund Status:</strong>
<span style="color: ${
    status === 'APPROVED'
      ? '#10b981'
      : status === 'INITIATED' ||
          status === 'PROCESSING' ||
          status === 'AUTO_REFUND_INITIATED'
        ? '#f59e0b'
        : status === 'REJECTED' || status === 'DELETED BY USER'
          ? '#ef4444'
          : '#6b7280'
  };">
  ${status === 'APPROVED' ? 'Processed/Approved' : status}
</span>
      </div>
    </div>

    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;"><strong>Refund Id :</strong></td>
        <td>${refund_id || 'NA'}</td>
        <td style="padding:6px 0;"><strong>Refund amount:</strong></td>
        <td>₹${refund_amount || 'NA'}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Refund initiated on :</strong></td>
        <td>${refund_initiated || 'NA'}</td>
        <td style="padding:6px 0;"><strong>Refund message:</strong></td>
        <td>${refund_remark || 'NA'}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Payment method:</strong></td>
        <td>${payment_method || 'NA'}</td>
        <td style="padding:6px 0;"><strong>Transaction amount:</strong></td>
        <td>₹${transaction_amount || 'NA'}</td>
      </tr>
      <tr>
       <td style="padding:6px 0;"><strong>Transaction Time</strong></td>
        <td>${formattedTransactionTime || 'NA'}</td>

        <td><strong>${bankOrProviderLabel}:</strong></td>
        <td>${bankOrProvider}</td>
      </tr>
      <tr>
       <td><strong>Reason:</strong></td>
        <td>${reason || 'NA'}</td>
        <td><strong>Bank reference number:</strong></td>
        <td>${bank_reference || 'NA'}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Currency:</strong></td>
        <td>INR</td>
        <td><strong>Edviron Order ID:</strong></td>
        <td>${collect_id || 'NA'}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Merchant Order ID:</strong></td>
        <td>${custom_order_id || 'NA'}</td>
        <td><strong>Refund Reason:</strong></td>
        <td>${refund_reason || 'N/A'}</td>
      </tr>
       <tr>
        <td style="padding:6px 0;"><strong>School Name:</strong></td>
        <td>${school_name || 'NA'}</td>
        <td><strong>School ID:</strong></td>
        <td>${school_id || 'NA'}</td>
      </tr>
      </tr>
    </table>
  </div>

  <h3 style="color:#111827;font-size:20px;margin-bottom:12px;">User details</h3>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;"><strong>Student name:</strong></td>
        <td>${student?.student_name || 'NA'}</td>
        <td><strong>Student Enrollment ID:</strong></td>
        <td>${student?.student_id || 'NA'}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;"><strong>Email:</strong></td>
        <td>${student?.student_email || 'NA'}</td>
        <td><strong>Phone number:</strong></td>
        <td>${student?.student_phone_no || 'NA'}</td>
    </table>
  </div>
${
  splitDetail.length > 0
    ? `
  <h3 style="color:#111827;font-size:20px;margin-bottom:12px;">Split details</h3>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">
    <table style="width:100%;font-size:14px;border-collapse:collapse;">
      <thead>
        <tr>
        <th style="text-align:left;padding:6px 0;border-bottom:1px solid #e5e7eb;">Vendor Id</th>
          <th style="text-align:left;padding:6px 0;border-bottom:1px solid #e5e7eb;">Vendor Name</th>
          <th style="text-align:left;padding:6px 0;border-bottom:1px solid #e5e7eb;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${splitDetail
          .map(
            (detail) => `
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">${detail.id}</td>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">${detail.vendor_name}</td>
            <td style="padding:6px 0;border-bottom:1px solid #e5e7eb;">${detail.amount}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  </div>
`
    : ''
}
        `;
}

export function generateEmailHTML2(settlements_transactions) {
  return `
  <div style="max-width:700px;margin:0 auto;padding:20px;font-family:sans-serif;background:#f9fafb;">
    <h2 style="color:#111827;font-size:24px;margin-bottom:20px;">Settlement details</h2>
    ${settlements_transactions
      .map((txn) => {
        const status = txn.event_status || 'NA';
        const transaction_amount = txn.event_amount;
        const formattedTransactionTime = new Date(
          txn.event_time,
        ).toLocaleString('en-IN');
        const bankOrProvider = txn.payment_utr || 'NA';
        const bankOrProviderLabel =
          txn.payment_group === 'NET_BANKING' ? 'Bank' : 'Provider';
        const gateway = txn.payment_group;
        return `
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="margin-bottom:16px;">
          <strong>Order ID:</strong> ${txn.custom_order_id || 'NA'} <br/>
          <strong>Order Amount:</strong> ₹${txn.order_amount || 'NA'} <br/>
          <strong>Status:</strong> 
          <span style="color:${
            status === 'SUCCESS'
              ? '#10b981'
              : status === 'PENDING'
                ? '#f59e0b'
                : '#ef4444'
          };">
            ${status}
          </span>
        </div>
        <table style="width:100%;font-size:14px;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;"><strong>Payment method:</strong></td>
            <td>${txn.payment_group || 'NA'}</td>
            <td style="padding:6px 0;"><strong>Transaction amount:</strong></td>
            <td>₹${transaction_amount || 'NA'}</td>
          </tr>
          <tr>
            <td><strong>Reason:</strong></td>
            <td>${txn.adjustment_remarks || 'NA'}</td>
            <td><strong>Bank reference number:</strong></td>
            <td>${txn.payment_utr || 'NA'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Currency:</strong></td>
            <td>${txn.event_currency || 'INR'}</td>
            <td><strong>Edviron Order ID:</strong></td>
            <td>${txn.order_id || 'NA'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Transaction Time</strong></td>
            <td>${formattedTransactionTime}</td>
            <td><strong>Remarks:</strong></td>
            <td>${status}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Student name:</strong></td>
            <td>${txn.student_name || 'NA'}</td>
            <td><strong>Student Enrollment ID:</strong></td>
            <td>${txn.student_id || 'NA'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;"><strong>Email:</strong></td>
            <td>${txn.student_email || 'NA'}</td>
            <td><strong>Phone number:</strong></td>
            <td>${txn.student_phone_no || 'NA'}</td>
          </tr>
      </div>
      `;
      })
      .join('')}
  </div>
  `;
}

export function generateEmailHTML(settlementDate) {
  const formattedDate = new Date(settlementDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `
    <div style="max-width:700px;margin:0 auto;padding:20px;font-family:sans-serif;background:#f9fafb;">
      <h2 style="color:#111827;font-size:24px;margin-bottom:16px;">
        Settlement File Acknowledgment
      </h2>
      <p style="font-size:16px;color:#374151;">
        Please find attached the settlement CSV file for <strong>${formattedDate}</strong>.
      </p>
    </div>
  `;
}

export function generateCSV(settlements_transactions) {
  const headers = [
    'Order ID',
    'Edviron Order ID',
    'Student Name',
    'Student ID',
    'Student Email',
    'Order Amount',
    'Transaction Amount',
    'Payment Method',
    'Status',
    'Transaction Time',
    'Bank Reference No.',
    'Settlement UTR',
  ];

  const rows = settlements_transactions.map((txn) => [
    txn.custom_order_id || 'NA',
    txn.order_id || 'NA',
    txn.student_name || 'NA',
    txn.student_id || 'NA',
    txn.student_email || 'NA',
    txn.order_amount || 'NA',
    txn.event_amount || 'NA',
    txn.payment_group || 'NA',
    txn.event_status || 'NA',
    (() => {
      const d = new Date(txn.event_time);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate(),
      )} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    })(),
    txn.payment_utr || 'NA',
    txn.settlement_utr || 'NA',
  ]);
  const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
  return csvContent;
}



export function generatePosRequest(
  school_id : string,
  school_name:string,
){
return `
   <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New POS Request from ${school_name}</title>

    <!-- Tailwind CSS via CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
  </head>

  <body class="bg-gray-100 font-sans antialiased">
    <div class="max-w-2xl mx-auto mt-10 bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">

      <!-- Header -->
      <div class="bg-blue-600 text-white py-6 text-center">
        <h1 class="text-2xl font-bold">🧾 New POS Machine Request</h1>
      </div>

      <!-- Body -->
      <div class="p-8">
        <p class="text-gray-800 mb-4">
          Hello <span class="font-semibold text-blue-600">Edviron Team</span>,
        </p>

        <p class="text-gray-700 leading-relaxed mb-6">
          A new <span class="font-semibold">POS Machine Request</span> has been submitted by a school under trustee supervision.
          Below are the request details:
        </p>

        <div class="bg-gray-50 border border-gray-200 rounded-lg p-5 text-gray-800">
          <p class="mb-2"><span class="font-semibold">🏫 School Name:</span> ${school_name }</p>
          <p class="mb-2"><span class="font-semibold">🏷️ School ID:</span> ${school_id}</p>
        </div>

        <p class="mt-6 text-gray-700">
          Kindly review this request and proceed with further action for POS machine allocation.
        </p>
      </div>
    </div>
  </body>
  </html>
`
}