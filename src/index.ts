import { Command } from 'commander'
import inquirer from 'inquirer'
import twilio from 'twilio'
import * as dotenv from 'dotenv'
import { table } from 'table'

dotenv.config()

const program = new Command()

program
  .name('twilio-tools')
  .description('CLI for interacting with Twilio API')
  .version('0.0.1')

program
  .command('list-numbers')
  .description('List all phone numbers in your Twilio account')
  .action(async () => {
    try {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
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

        const client = twilio(credentials.accountSid, credentials.authToken)
        await listNumbers(client)
      } else {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
        await listNumbers(client)
      }
    } catch (error) {
      console.error('Error listing numbers: ', error)
    }
  })

async function listNumbers(client: twilio.Twilio) {
  console.log('Fetching phone numbers...')

  try {
    const incomingPhoneNumbers = await client.incomingPhoneNumbers.list()

    if (incomingPhoneNumbers.length === 0) {
      console.log('No phone numbers found in this account.')
      return
    }

    const data = [
      ['Phone Number', 'Friendly Name', 'SID', 'Capabilities']
    ]

    incomingPhoneNumbers.forEach(number => {
      const capabilities = []
      if (number.capabilities?.voice) capabilities.push('Voice')
      if (number.capabilities?.sms) capabilities.push('SMS')
      if (number.capabilities?.mms) capabilities.push('MMS')

      data.push([
        number.phoneNumber,
        number.friendlyName,
        number.sid,
        capabilities.join(', ')
      ])
    })

    console.log(table(data))
  } catch (error) {
    console.error('Failed to retrieve phone numbers: ', error)
  }
}

program.parse(process.argv)