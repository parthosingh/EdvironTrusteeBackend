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
                      <td style="padding: 10px; border: 1px solid #f5c6cb; background-color: #fdf2f2;">${
                        error.message || message
                      }</td>
                  </tr>
                  <tr>
                      <th style="text-align: left; padding: 10px; background-color: #f8d7da; border: 1px solid #f5c6cb;">Stack Trace</th>
                      <td style="padding: 10px; border: 1px solid #f5c6cb; background-color: #fdf2f2;">
                          <pre style="white-space: pre-wrap; background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow: auto;">${
                            error.stack
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