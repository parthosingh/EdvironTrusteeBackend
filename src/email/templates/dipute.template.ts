import { Disputes } from '../../schema/disputes.schema';

export function getAdminEmailTemplate(
  dispute: Disputes,
  isClosed: boolean = false,
): string {
  const {
    dispute_id,
    collect_id,
    dispute_type,
    reason_description,
    dispute_amount,
    payment_amount,
    dispute_created_date,
    dispute_respond_by_date,
    dispute_status,
  } = dispute;

  const statusColor: string = isClosed ? '#28a745' : '#dc3545';
  const statusText: string = isClosed ? 'Resolved' : 'Open';

  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <h2 style="text-align: center; color: #333;">Dispute ${
      isClosed ? 'Resolution' : 'Raised'
    }</h2>

    <p style="text-align: center; font-size: 14px; color: #555;">
      A dispute has been <strong style="color: ${statusColor};">${statusText}</strong>. Please review the details below.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      ${generateTableRow('Dispute ID', dispute_id)}
      ${generateTableRow('Collect ID', collect_id)}
      ${generateTableRow('Dispute Type', dispute_type)}
      ${generateTableRow('Reason', reason_description)}
      ${generateTableRow('Dispute Amount', `₹${dispute_amount}`)}
      ${generateTableRow('Payment Amount', `₹${payment_amount}`)}
      ${generateTableRow(
        'Dispute Initiated On',
        dispute_created_date.toLocaleDateString('en-GB'),
      )}
      ${generateTableRow(
        'Response Required By',
        dispute_respond_by_date.toLocaleDateString('en-GB'),
      )}
      ${generateTableRow(
        'Current Status',
        `<span style="color: ${statusColor}; font-weight: bold;">${dispute_status}</span>`,
      )}
    </table>

    <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
      Kindly take the necessary action by reviewing the dispute details in the admin panel.
    </p>
  </div>`;
}

export function getCustomerEmailTemplate(
  dispute: Disputes,
  school_name: string,
  isClosed: boolean = false,
): string {
  const {
    dispute_id,
    collect_id,
    payment_amount,
    dispute_created_date,
    dispute_respond_by_date,
    dispute_status,
  } = dispute;

  const statusColor: string = isClosed ? '#28a745' : '#dc3545';
  const statusText: string = isClosed ? 'Resolved' : 'Open';

  return `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
    <h2 style="text-align: center; color: #333;">Dispute ${
      isClosed ? 'Resolved' : 'Notification'
    }</h2>

    <p style="text-align: center; font-size: 14px; color: #555;">
      We would like to inform you that a dispute has been <strong style="color: ${statusColor};">${statusText}</strong> regarding your recent transaction with <strong>${school_name}</strong>. Below are the details:
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
      ${generateTableRow('Dispute ID', dispute_id)}
      ${generateTableRow('Transaction Reference', collect_id)}
      ${generateTableRow('Payment Amount', `₹${payment_amount}`)}
      ${generateTableRow(
        'Dispute Initiated On',
        dispute_created_date.toLocaleDateString('en-GB'),
      )}
      ${generateTableRow(
        'Response Required By',
        dispute_respond_by_date.toLocaleDateString('en-GB'),
      )}
      ${generateTableRow(
        'Current Status',
        `<span style="color: ${statusColor}; font-weight: bold;">${dispute_status}</span>`,
      )}
    </table>

    <p style="text-align: center; margin-top: 20px; font-size: 14px; color: #666;">
      If you have any concerns or require further assistance, please reach out to our customer support team.
    </p>
  </div>`;
}

function generateTableRow(label: string, value: string | number): string {
  return `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #333;">${label}:</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #555;">${value}</td>
    </tr>
  `;
}

export function getDisputeReceivedEmailForTeam(
  dispute_id: string,
  collect_id: string,
  action: string,
  reason: string,
  gateway: string,
  documents: { document_type: string; file_url: string }[],
) {
  return `
  <!DOCTYPE html>
    <html>
    <head>
    <title>Page Title</title>
    </head>
    <body>
    <div style="font-family: Arial, sans-serif; width: 100%; text-align: center; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #d32f2f;">Dispute Document Received</h2>
        <p style="color: #333;">Hello Team,</p>
        <p style="color: #333;">A new dispute document has been received with the following details:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Dispute ID:</td><td style="padding: 10px;">${dispute_id}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Transaction ID:</td><td style="padding: 10px;">${collect_id}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Action:</td><td style="padding: 10px;">${action}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Reason:</td><td style="padding: 10px;">${reason}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Gateway:</td><td style="padding: 10px; color: #d32f2f;">${gateway}</td></tr>
        </table>
        <h3 style="color: #d32f2f; margin-top: 20px;">Submitted Documents</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr style="background: #f8f8f8;">
            <th style="padding: 10px; text-align: center;">Document Type</th>
            <th style="padding: 10px; text-align: center;">Link</th>
            </tr>
            ${documents
              .map(
                (doc) =>
                  `<tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">${doc.document_type}</td><td style="padding: 10px;"><a href="${doc.file_url}" style="color: #1e88e5; text-decoration: none;">View</a></td></tr>`,
              )
              .join('')}
        </table>
        <p style="color: #333;">Please review and take necessary action.</p>
        <p style="color: #555; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
    </div>
    </body>
    </html>`;
}

export function getDisputeReceivedEmailForUser(
  dispute_id: string,
  collect_id: string,
  action: string,
  reason: string,
  documents: { document_type: string; file_url: string }[],
) {
  return `
  <!DOCTYPE html>
    <html>
    <head>
    <title>Page Title</title>
    </head>
    <body>
    <div style="font-family: Arial, sans-serif; width: 100%; text-align: center; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: auto; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
        <h2 style="color: #2e7d32;">Dispute Document Submitted</h2>
        <p style="color: #333;">Dear User,</p>
        <p style="color: #333;">Your dispute documents have been successfully submitted. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Dispute ID:</td><td style="padding: 10px;">${dispute_id}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Transaction ID:</td><td style="padding: 10px;">${collect_id}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Action:</td><td style="padding: 10px;">${action}</td></tr>
            <tr><td style="padding: 10px; font-weight: bold; background: #f8f8f8;">Reason:</td><td style="padding: 10px;">${reason}</td></tr>
        </table>
        <h3 style="color: #2e7d32; margin-top: 20px;">Submitted Documents</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr style="background: #f8f8f8;">
            <th style="padding: 10px; text-align: center;">Document Type</th>
            <th style="padding: 10px; text-align: center;">Link</th>
            </tr>
            ${documents
              .map(
                (doc) =>
                  `<tr><td style="padding: 10px;">${doc.document_type}</td><td style="padding: 10px;"><a href="${doc.file_url}" style="color: #1e88e5; text-decoration: none;">View</a></td></tr>`,
              )
              .join('')}
        </table>
        <p style="color: #333;">We will review your submission and update you accordingly.</p>
        <p style="color: #555; font-size: 12px;">This is an automated email. Please do not reply.</p>
        </div>
    </div>
    </body>
    </html>
`;
}
