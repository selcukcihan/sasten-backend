import { Inject, Service } from 'typedi'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

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

interface Question {
  question: string
  options: string[]
  answer: number
}

interface Quiz {
  date: string
  questions: Question[]
}

@Service()
export class QuizGenerator {
  constructor(
    @Inject('DYNAMODB_CLIENT') private readonly docClient: DynamoDBDocumentClient,
    @Inject('GOOGLE_AI_CLIENT') private readonly ai: GoogleGenerativeAI,
  ) {}

  private async getQuiz(date: string) {
    const response = await this.docClient.send(new GetCommand({
      TableName: process.env.TABLE_NAME || '',
      Key: {
        pk: `QUIZ#${date}`,
        sk: `QUIZ`,
      },
    }))
    return response.Item ? response.Item.questions : null
  }

  async generate() {
    const model = this.ai.getGenerativeModel({ model: 'gemini-1.5-pro-latest' })
  
    const generationConfig = {
      temperature: 1,
      topK: 0,
      topP: 0.95,
      maxOutputTokens: 8192,
    }
  
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ]
  
    let prompt = PROMPT_1 + PROMPT_2

    let today = new Date().toISOString().split('T')[0]
    for (let i = 0; i < 5; i++) {
      const quiz = await this.getQuiz(today)
      if (quiz) {
        prompt += `Example quiz ${i + 1}:\n${JSON.stringify(quiz, null, 2)}\n\n`
      } else {
        break
      }
      today = new Date(+new Date(today) - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  
    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: [],
    })
  
    prompt += PROMPT_3
    console.log(prompt)
    const result = await chat.sendMessage(prompt)
    const response = result.response
    const generated = response.text() || ''
    console.log(generated)

    const cleanedString = generated.split('\n').filter(line => !line.includes('```')).join('\n');
    const quiz: Quiz = {
      date: new Date(2 * 24 * 60 * 60 * 1000 + +new Date()).toISOString().split('T')[0],
      questions: JSON.parse(cleanedString),
    }

    await this.docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME || '',
      Item: {
        pk: `QUIZ#${quiz.date}`,
        sk: `QUIZ`,
        questions: quiz.questions,
        date: quiz.date,
      },
    }))
  }
}
