export function generateErrorEmailTemplate(
  error: Error,
  details: any,
  message: string,
) {
  const formattedDetails = details
    ? `<pre style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow: auto;">${JSON.stringify(
      details,
      null,
      2,
    )}</pre>`
    : '<p>No additional details provided.</p>';

  return `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 100vw; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
              <h2 style="color: #e74c3c; text-align: center;">🚨 Error Notification 🚨</h2>
              <p style="font-size: 16px;">Dear Team,</p>
              <p style="font-size: 16px;">An error has occurred in the application. Please find the details below:</p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                  <tr>
                      <th style="text-align: left; padding: 10px; background-color: #f8d7da; border: 1px solid #f5c6cb;">Error Message</th>
                      <td style="padding: 10px; border: 1px solid #f5c6cb; background-color: #fdf2f2;">${error.message || message
    }</td>
                  </tr>
                  <tr>
                      <th style="text-align: left; padding: 10px; background-color: #f8d7da; border: 1px solid #f5c6cb;">Stack Trace</th>
                      <td style="padding: 10px; border: 1px solid #f5c6cb; background-color: #fdf2f2;">
                          <pre style="white-space: pre-wrap; background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow: auto;">${error.stack
    }</pre>
                      </td>
                  </tr>
              </table>
              
              <h3 style="margin-top: 20px; color: #e74c3c;">Additional Details:</h3>
              ${formattedDetails}
              <p style="font-size: 14px; color: #666; margin-top: 20px;">This is an automated email. Please investigate the issue as soon as possible.</p>
              <div style="text-align: center; margin-top: 20px;">
                  <p style="font-size: 12px; color: #aaa;">&copy; ${new Date().getFullYear()} Edviron</p>
              </div>
          </div>
      `;
}


const createTableRow = (label, value) => {
  return value ? `<tr><th>${label}</th><td>${value}</td></tr>` : '';
};

export function sendQueryErrortemplate(
  queryName: string,
  error: string,
  message: string,
  timestamp: string,
  user?: {
    id: string;
    role: string;
  },
) {
  const now = new Date(timestamp);
  const time = `${
    now.toISOString().split('T')[0]
  }, ${now.toLocaleTimeString()}`;

  return `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f8f9fa; color: #333;">
        <div style="max-width: 100vw; margin: auto; background-color: #ffffff;">
          
          <h2 style="color: #d32f2f; text-align: center; margin-bottom: 15px;">⚠ Error Report: <strong>${queryName}</strong> ⚠</h2>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
              <tr>
                <td style="font-weight: bold; padding: 10px; background-color: #fbe9e7;">Query Name</td>
                <td style="padding: 10px;">${queryName}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 10px; background-color: #fbe9e7;">Timestamp</td>
                <td style="padding: 10px;">${time}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 10px; background-color: #fbe9e7;">Message</td>
                <td style="padding: 10px;">${message}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 10px; background-color: #fbe9e7;">Error Details</td>
                <td style="padding: 10px;">
                  <div style="max-width: 100%; overflow-x: auto;">
                    <pre style="margin: 0; padding: 10px; background-color: #ffebee; border-radius: 4px; font-size: 14px; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(
                      JSON.parse(error),
                      null,
                      2,
                    )}</pre>
                  </div>
                </td>
              </tr>
              ${
                user
                  ? `
              <tr>
                <td style="font-weight: bold; padding: 10px; background-color: #fbe9e7;">User Info</td>
                <td style="padding: 10px;"><strong>ID:</strong> ${user.id} <br><strong>Role:</strong> ${user.role}</td>
              </tr>`
                  : ''
              }
            </table>
          </div>

          <p style="text-align: center; color: #777; font-size: 12px; margin-top: 15px;">This is an automated error report. Please investigate the issue.</p>

        </div>
      </body>
    </html>
  `;
}