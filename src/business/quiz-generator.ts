import { Inject, Service } from 'typedi'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const PROMPT = `
I'm creating a quiz game for software developers. Each question will have 4 options of which 1 of them is the correct answer.
Create 5 such questions for me, presented as a json of the following form. An example:

{
  "questions": [
    {
      "answer": 3,
      "options": [
        "Java",
        "Python",
        "C++",
        "JavaScript"
      ],
      "question": "Which programming language is primarily used for web development and runs in the browser?"
    },
    {
      "answer": 0,
      "options": [
        "Hypertext Markup Language",
        "Home Tool Markup Language",
        "Hyperlinking Text Marking Language",
        "Hypertext Management Language"
      ],
      "question": "What does HTML stand for?"
    },
    {
      "answer": 2,
      "options": [
        "int",
        "list",
        "str",
        "dict"
      ],
      "question": "In Python, which data type is used to represent text?"
    },
    {
      "answer": 1,
      "options": [
        "Branch",
        "Fork",
        "Merge",
        "Commit"
      ],
      "question": "In Git, what is the term used for creating a personal copy of someone else's project?"
    },
    {
      "answer": 3,
      "options": [
        "Agile",
        "Waterfall",
        "Kanban",
        "Scrum"
      ],
      "question": "Which Agile framework uses time-boxed iterations called sprints?"
    }
  ]
}
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
  
    const chat = model.startChat({
      generationConfig,
      safetySettings,
      history: [
      ],
    })

    const result = await chat.sendMessage(PROMPT)
    const response = result.response
    const generated = response.text() || ''
    console.log(generated)

    const quiz: Quiz = JSON.parse(generated)
    quiz.date = new Date(2 * 24 * 60 * 60 * 1000 + +new Date()).toISOString().split('T')[0]

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
