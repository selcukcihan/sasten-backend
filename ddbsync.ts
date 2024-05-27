const AWS = require('aws-sdk');

const sourceTable = 'sasten';
const targetTable = 'sasten-data';

async function scanTable() {
  // This function scans the source DynamoDB table and returns all items in the table using pagination.
  let items: any[] = [];
  let params = {
    TableName: sourceTable,
    ExclusiveStartKey: null,
  };
  AWS.config.update({ region: 'eu-west-1' });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  try {
    do {
      const data = await dynamodb.scan(params).promise();
      items = items.concat(data.Items);
      params.ExclusiveStartKey = data.LastEvaluatedKey;
    } while (typeof params.ExclusiveStartKey !== 'undefined' && params.ExclusiveStartKey);
  } catch (error) {
    console.error(`Unable to scan the table. Error JSON: ${JSON.stringify(error, null, 2)}`);
  }
  return items
}

async function insertIntoTable(items: any[]) {
  AWS.config.update({ region: 'us-east-1' });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
    for (const item of items) {
        let params = {
            TableName: targetTable,
            Item: item
        };

        try {
            await dynamodb.put(params).promise();
            console.log(`Inserted item: ${JSON.stringify(item)}`);
        } catch (error) {
            console.error(`Unable to insert item. Error JSON: ${JSON.stringify(error, null, 2)}`);
        }
    }
}

async function transferData() {
    try {
        const items = await scanTable();
        console.log(`Scanned ${items.length} items from ${sourceTable}`);
        await insertIntoTable(items);
        console.log(`Successfully inserted items into ${targetTable}`);
    } catch (error) {
        console.error(`Error transferring data: ${error}`);
    }
}

transferData();
