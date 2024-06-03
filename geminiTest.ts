import { GoogleGenerativeAI, Content } from '@google/generative-ai'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb"

require('dotenv').config()

const AWS = require('aws-sdk')

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const PROMPT_1 = `
I'm creating a quiz game for software developers. Each question will have 4 options of which 1 of them is the correct answer.
`

const PROMPT_2 = `
Some example quizzes:

`

const PROMPT_3 = `
Create 5 questions for my quiz game, presented as a json of the following form. Only output a valid json, without any other data or formatting.
The response should be a valid JSON object.
The questions should not be very easy. They should be challenging enough for a software developer.

Go ahead, create a quiz for me please.
`

const getQuiz = async (date: string) => {
  const response = await docClient.send(new GetCommand({
    TableName: process.env.TABLE_NAME || '',
    Key: {
      pk: `QUIZ#${date}`,
      sk: `QUIZ`,
    },
  }))
  return response.Item ? response.Item.questions : null
}

async function test() {
  const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY as string)
  const model = ai.getGenerativeModel({ model: 'gemini-1.5-pro-latest' })
  const generationConfig = {
    temperature: 1,
    topK: 0,
    topP: 0.95,
    maxOutputTokens: 8192,
  }

  let prompt = PROMPT_1 + PROMPT_2

  let today = new Date().toISOString().split('T')[0]
  for (let i = 0; i < 5; i++) {
    const quiz = await getQuiz(today)
    if (quiz) {
      prompt += `Example quiz ${i + 1}:\n${JSON.stringify(quiz, null, 2)}\n\n`
    } else {
      break
    }
    today = new Date(+new Date(today) - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }

  const chat = model.startChat({
    generationConfig,
    history: [],
  })

  prompt += PROMPT_3
  console.log(prompt)
  const result = await chat.sendMessage(prompt)
  const response = result.response
  const generated = response.text() || ''
  console.log(generated)
}

test()
