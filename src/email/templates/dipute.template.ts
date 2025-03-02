import { Disputes } from 'src/schema/disputes.schema';

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
