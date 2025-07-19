export function sendEnablePgInfotemp(data) {
  return `
<div style="max-width: 600px; margin: auto; padding: 20px; font-family: Arial, sans-serif; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
    <h2 style="color: #4CAF50; text-align: center;">${data.status}</h2>
    <p style="text-align: center; font-size: 16px; color: #555;">Here is the data summary:</p>
    <table style="width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);">
        <tr>
            <th style="background: #4CAF50; color: white; padding: 10px; text-align: left;">Field</th>
            <th style="background: #4CAF50; color: white; padding: 10px; text-align: left;">Value</th>
        </tr>
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">Trustee ID</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${data.trustee_id}</td>
        </tr>
            <td style="border: 1px solid #ddd; padding: 8px;">School ID</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${data.school_id}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">PG Key</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${data.pg_key}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">School Name</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${data.school_name}</td>
        </tr>
    </table>
    <p style="text-align: center; margin-top: 20px; color: #777;">Thank you!</p>
</div>
`;
}
