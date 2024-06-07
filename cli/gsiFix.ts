async function gsiFix() {
  const AWS = require('aws-sdk');

  const table = 'sasten-data';

  async function scanTable() {
    // This function scans the source DynamoDB table and returns all items in the table using pagination.
    let items: any[] = [];
    let params = {
      TableName: table,
      ExclusiveStartKey: null,
    };
    AWS.config.update({ region: 'us-east-1' });

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

  async function updateItems(items: any[]) {
    AWS.config.update({ region: 'us-east-1' });

    const dynamodb = new AWS.DynamoDB.DocumentClient();
      for (const item of items) {
        if (item.gsi1pk && item.gsi1sk) {
          let params = {
              TableName: table,
              Key: {
                pk: item.pk,
                sk: item.sk,
              },
              UpdateExpression: 'SET #GSI1PK = :GSI1PK, #GSI1SK = :GSI1SK',
              ExpressionAttributeNames: {
                '#GSI1PK': 'GSI1PK',
                '#GSI1SK': 'GSI1SK'
              },
              ExpressionAttributeValues: {
                ':GSI1PK': item.gsi1pk,
                ':GSI1SK': item.gsi1sk
              }
          };

          try {
              await dynamodb.update(params).promise();
              console.log(`Updated item: ${JSON.stringify(item)}`);
          } catch (error) {
              console.error(`Unable to update item. Error JSON: ${JSON.stringify(error, null, 2)}`);
          }
      }
    }
  }

  async function transferData() {
      try {
          const items = await scanTable();
          console.log(`Scanned ${items.length} items from ${table}`);
          await updateItems(items);
          console.log(`Successfully updated items in ${table}`);
      } catch (error) {
          console.error(`Error transferring data: ${error}`);
      }
  }

  await transferData();
}

gsiFix()
