import inquirer from 'inquirer'
import twilio from 'twilio'
import * as dotenv from 'dotenv'
import { table } from 'table'

dotenv.config()

let twilioClient: twilio.Twilio | null = null

async function ensureTwilioClient(): Promise<twilio.Twilio> {
  if (twilioClient) {
    return twilioClient
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    return twilioClient
  }

  const credentials = await inquirer.prompt([
    {
      type: 'input',
      name: 'accountSid',
      message: 'Enter your Twilio Account SID: ',
      validate: (input) => input.trim() !== '' || 'Account SID is required'
    },
    {
      type: 'password',
      name: 'authToken',
      message: 'Enter your Twilio Auth Token: ',
      validate: (input) => input.trim() !== '' || 'Auth Token is required'
    }
  ])

  twilioClient = twilio(credentials.accountSid, credentials.authToken)
  return twilioClient
}

async function listNumbers() {
  console.log('Fetching phone numbers...');
  
  try {
    const client = await ensureTwilioClient();
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list();
    
    if (incomingPhoneNumbers.length === 0) {
      console.log('No phone numbers found in this account.');
      return;
    }
    
    const data = [
      ['Phone Number', 'Friendly Name', 'SID', 'Capabilities']
    ];
    
    incomingPhoneNumbers.forEach(number => {
      const capabilities = [];
      if (number.capabilities?.voice) capabilities.push('Voice');
      if (number.capabilities?.sms) capabilities.push('SMS');
      if (number.capabilities?.mms) capabilities.push('MMS');
      
      data.push([
        number.phoneNumber,
        number.friendlyName,
        number.sid,
        capabilities.join(', ')
      ]);
    });
    
    console.log(table(data));
  } catch (error) {
    console.error('Failed to retrieve phone numbers:', error);
  }
}

async function purchaseNumber() {
  try {
    const client = await ensureTwilioClient();
    
    // Ask for search criteria
    const { searchType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'searchType',
        message: 'How would you like to search for a number?',
        choices: [
          { name: 'By Area Code', value: 'areaCode' },
          { name: 'By Country', value: 'country' }
        ]
      }
    ]);
    
    let searchParams: any = {};
    
    if (searchType === 'areaCode') {
      const { areaCode } = await inquirer.prompt([
        {
          type: 'input',
          name: 'areaCode',
          message: 'Enter area code (e.g., 415):',
          validate: (input) => /^\d{3}$/.test(input) || 'Please enter a valid 3-digit area code'
        }
      ]);
      
      searchParams = {
        areaCode,
        country: 'US'
      };
    } else {
      const { country } = await inquirer.prompt([
        {
          type: 'input',
          name: 'country',
          message: 'Enter country code (e.g., US, CA, GB):',
          default: 'US',
          validate: (input) => /^[A-Z]{2}$/.test(input) || 'Please enter a valid 2-letter country code'
        }
      ]);
      
      searchParams = { country };
    }
    
    // Ask for capabilities
    const { capabilities } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'capabilities',
        message: 'Select required capabilities:',
        choices: [
          { name: 'Voice', value: 'voice' },
          { name: 'SMS', value: 'sms' },
          { name: 'MMS', value: 'mms' }
        ],
        default: ['voice', 'sms']
      }
    ]);
    
    if (capabilities.includes('voice')) {
      searchParams.voiceEnabled = true;
    }
    
    if (capabilities.includes('sms')) {
      searchParams.smsEnabled = true;
    }
    
    if (capabilities.includes('mms')) {
      searchParams.mmsEnabled = true;
    }
    
    console.log('Searching for available numbers...');
    const availableNumbers = await client.availablePhoneNumbers(searchParams.country)
      .local
      .list(searchParams);
    
    if (availableNumbers.length === 0) {
      console.log('No phone numbers found matching your criteria. Please try different search parameters.');
      return;
    }
    
    // Display available numbers
    const data = [
      ['Phone Number', 'Region', 'Capabilities']
    ];
    
    availableNumbers.forEach((number, index) => {
      const capabilities = [];
      if (number.capabilities.voice) capabilities.push('Voice');
      if (number.capabilities.sms) capabilities.push('SMS');
      if (number.capabilities.mms) capabilities.push('MMS');
      
      data.push([
        number.phoneNumber,
        number.region || number.locality || 'N/A',
        capabilities.join(', ')
      ]);
    });
    
    console.log(table(data));
    
    // Ask user to select a number
    const { selectedIndex } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedIndex',
        message: 'Select a number to purchase:',
        choices: availableNumbers.map((number, index) => ({
          name: `${number.phoneNumber} (${number.region || number.locality || 'N/A'})`,
          value: index
        })).concat([{ name: 'Cancel', value: -1 }])
      }
    ]);
    
    if (selectedIndex === -1) {
      console.log('Purchase cancelled.');
      return;
    }
    
    const selectedNumber = availableNumbers[selectedIndex];
    
    // Ask for friendly name
    const { friendlyName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'friendlyName',
        message: 'Enter a friendly name for this number:',
        default: `${selectedNumber.region || selectedNumber.locality || 'New'} Number`
      }
    ]);
    
    // Confirm purchase
    const { confirmPurchase } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmPurchase',
        message: `Are you sure you want to purchase ${selectedNumber.phoneNumber}?`,
        default: false
      }
    ]);
    
    if (!confirmPurchase) {
      console.log('Purchase cancelled.');
      return;
    }
    
    // Purchase the number
    console.log('Purchasing phone number...');
    const purchasedNumber = await client.incomingPhoneNumbers.create({
      phoneNumber: selectedNumber.phoneNumber,
      friendlyName
    });
    
    console.log(`Successfully purchased ${purchasedNumber.phoneNumber}!`);
    console.log(`Phone Number SID: ${purchasedNumber.sid}`);
    console.log(`Friendly Name: ${purchasedNumber.friendlyName}`);
    
  } catch (error) {
    console.error('Error purchasing phone number:', error);
  }
}

async function showMainMenu() {
  console.log('\n🔹 Twilio Tools 🔹\n');

  let exitProgram = false

  while (!exitProgram) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'List Phone Numbers', value: 'list-numbers' },
          { name: 'Purchase Phone Number', value: 'purchase-number' },
          { name: 'Exit', value: 'exit' }
        ]
      }
    ])

    switch (action) {
      case 'list-numbers':
        await listNumbers()
        break
      case 'purchase-number':
        await purchaseNumber()
        break
      case 'exit':
        console.log('Goodbye!')
        exitProgram = true
        break
    }

    if (!exitProgram) {
      await inquirer.prompt([
        {
          type: 'input',
          name: 'continue',
          message: 'Press Enter to continue...'
        }
      ])
    }
  }
}

(async () => {
  try {
    await showMainMenu()
  } catch (error) {
    console.error('An error occurred: ', error)
    process.exit(1)
  }
})()