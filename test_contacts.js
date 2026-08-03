const fs = require('fs');
if (fs.existsSync('./store-data-for-use/contacts.json')) {
  const data = fs.readFileSync('./store-data-for-use/contacts.json', 'utf8');
  const contacts = JSON.parse(data);
  console.log(`Found ${Object.keys(contacts).length} contacts.`);
} else {
  console.log('No contacts.json found.');
}
