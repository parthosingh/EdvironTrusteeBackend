export function generateVendorRequestEmailTemplate({
  trustee_id,
  school_name,
  school_id,
  vendor_info,
}: {
  trustee_id: string;
  school_name: string;
  school_id: string;
  vendor_info: {
    name: string;
    email: string;
    phone: string;
    status: string;
  };
}) {
  return `
 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; padding: 20px; background-color: #f4f8ff;">
      <h2 style="color: #2c3e50; text-align: center;">New Vendor Request Received</h2>
      <p style="font-size: 16px; color: #34495e;">A new request has been received to create a vendor for your school.</p>
      
      <div style="background-color: #eaf2ff; padding: 15px; border-radius: 5px; box-shadow: 0px 0px 5px rgba(0,0,0,0.1);">
        <h3 style="color: #2c3e50;">School Details</h3>
        <p><strong>Trustee ID:</strong> <span style="color: #2980b9;">${trustee_id}</span></p>
        <p><strong>School Name:</strong> <span style="color: #2980b9;">${school_name}</span></p>
        <p><strong>School ID:</strong> <span style="color: #2980b9;">${school_id}</span></p>
      </div>
      
      <div style="background-color: #eafaf1; padding: 15px; border-radius: 5px; box-shadow: 0px 0px 5px rgba(0,0,0,0.1); margin-top: 15px;">
        <h3 style="color: #2c3e50;">Vendor Details</h3>
        <p><strong>Name:</strong> <span style="color: #16a085;">${vendor_info.name}</span></p>
        <p><strong>Email:</strong> <span style="color: #16a085;">${vendor_info.email}</span></p>
        <p><strong>Phone:</strong> <span style="color: #16a085;">${vendor_info.phone}</span></p>
        <p><strong>Status:</strong> <span style="color: #FFA500; font-weight: bold;">${vendor_info.status}</span></p>
      </div>
      
      <p style="text-align: center; margin-top: 20px;">
        <a href='https://admin.edviron.com/manage-mdr/${trustee_id}' style="background-color: #007bff; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review Request</a>
      </p>
    </div>
  `;
}
