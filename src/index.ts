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
          { name: 'Exit', value: 'exit' }
        ]
      }
    ])

    switch (action) {
      case 'list-numbers':
        await listNumbers()
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