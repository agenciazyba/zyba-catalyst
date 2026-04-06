require('dotenv').config({ path: './functions/Zoho_api/.env' });
const { runCoqlQuery, zohoGetRecord } = require('./functions/Zoho_api/services/zoho.js');

async function test() {
  try {
    const q = "select id, Deal_Name from Sales_Orders limit 0, 1";
    const res = await runCoqlQuery(q);
    const dealId = res.data[0].Deal_Name.id;
    console.log("Found Deal ID:", dealId);
    
    const deal = await zohoGetRecord("Deals", dealId);
    console.log("Keys in Deal:", Object.keys(deal).join(", "));
    console.log("Deal_Cover:", deal.Deal_Cover);
    console.log("File_Upload:", deal.File_Upload);
  } catch(e) {
    console.error(e);
  }
}
test();
