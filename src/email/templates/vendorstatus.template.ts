interface Vendor {
  vendor_id: string;
  vendor_name: string;
  vendor_email: string;
  school_name: string;
  school_id: string;
  trustee_id: string;
}

export function generateVendorStatusEmailTemplate(vendor: Vendor): string {
  const {
    vendor_id,
    vendor_name,
    vendor_email,
    school_name,
    school_id,
    trustee_id,
  } = vendor;

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Vendor Status Pending - Immediate Attention Required</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
      <table align="center" width="100%" style="width:98%; margin: 20px auto; background: #ffffff; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
    
        <tr>
          <td style="padding: 20px; text-align: center; background-color: #ff9800; color: #ffffff; border-top-left-radius: 10px; border-top-right-radius: 10px;">
            <h2 style="margin: 0;">Vendor Status Pending for Over 1 Hour</h2>
          </td>
        </tr>

        <tr>
          <td style="padding: 15px; background: #fff3cd; text-align: center; color: #856404; font-size: 16px;">
            <strong>Attention Needed:</strong> This vendor was approved more than 1 hour ago, but their status is still <span style="color: #d9534f;"><strong>PENDING</strong></span>.
          </td>
        </tr>

        <tr>
          <td style="padding: 20px;">
           
            <p style="font-size: 16px; color: #555555;">
            The following vendor's status has not been updated since their approval. Please review the details below and take appropriate action.
            </p>

            <table width="100%" style="border-collapse: collapse; margin-top: 10px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #dddddd; background: #f8f9fa;"><strong>Vendor Name:</strong></td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${vendor_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #dddddd; background: #f8f9fa;"><strong>Vendor Email:</strong></td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${vendor_email}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #dddddd; background: #f8f9fa;"><strong>Vendor ID:</strong></td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${vendor_id}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #dddddd; background: #f8f9fa;"><strong>School Name:</strong></td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${school_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #dddddd; background: #f8f9fa;"><strong>School ID:</strong></td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${school_id}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #dddddd; background: #f8f9fa;"><strong>Trustee ID:</strong></td>
                <td style="padding: 8px; border: 1px solid #dddddd;">${trustee_id}</td>
              </tr>
            </table>

            <p style="font-size: 14px; color: #777777; text-align: center;">
              This is an automated email sent for internal monitoring. Thank you for your attention to this matter.
            </p>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}
