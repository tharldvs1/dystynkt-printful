const { createHmac } = require('crypto');

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { snipcartOrder, items, shippingAddress } = req.body;

    // Validate required data
    if (!snipcartOrder || !items || !shippingAddress) {
      return res.status(400).json({ error: 'Missing required order data' });
    }

    console.log('Processing order:', snipcartOrder.invoiceNumber);

    // Map Snipcart items to Printful items
    const printfulItems = items.map(item => {
      // Map your product IDs to Printful variant IDs
      const variantMap = {
        'classic-tshirt-bella-3001': 4011, // Bella+Canvas 3001 - White
        'premium-tshirt-triblend': 212,    // Gildan 64000 - Black
        'classic-hoodie-18500': 17338,     // Gildan 18500 - Black
        'premium-hoodie-zip': 1483,        // Gildan 18500 Zip - Black
        'ceramic-mug-11oz': 1003,          // 11oz Mug - White
        'premium-poster-12x18': 1          // Placeholder - update with actual variant ID
      };

      const variantId = variantMap[item.id] || 4011;

      return {
        variant_id: variantId,
        quantity: item.quantity,
        files: [
          {
            url: 'https://files.catbox.moe/1p8f9p.png' // Replace with your design URL
          }
        ],
        name: item.name
      };
    });

    // Create Printful order payload
    const printfulOrder = {
      recipient: {
        name: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
        address1: shippingAddress.address1,
        address2: shippingAddress.address2 || '',
        city: shippingAddress.city,
        state_code: shippingAddress.province || shippingAddress.state || 'CA',
        country_code: shippingAddress.country,
        zip: shippingAddress.postalCode,
        phone: shippingAddress.phone || '',
        email: snipcartOrder.email
      },
      items: printfulItems,
      external_id: snipcartOrder.invoiceNumber || snipcartOrder.token
    };

    // Get Printful API key from environment variables
    const PRINTFUL_API_KEY = process.env.clint || process.env.PRINTFUL_API_KEY;
    
    if (!PRINTFUL_API_KEY) {
      throw new Error('Printful API key not configured');
    }

    // Send order to Printful
    const response = await fetch('https://api.printful.com/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Dystynkt.com/1.0'
      },
      body: JSON.stringify(printfulOrder)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Printful API error:', result);
      return res.status(500).json({ 
        error: 'Failed to create Printful order',
        details: result,
        printfulPayload: printfulOrder
      });
    }

    console.log('✅ Printful order created successfully:', result.result.id);
    return res.status(200).json({ 
      success: true, 
      printfulOrderId: result.result.id,
      message: 'Order sent to Printful successfully',
      snipcartOrder: snipcartOrder.invoiceNumber
    });

  } catch (error) {
    console.error('❌ Error processing order:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}