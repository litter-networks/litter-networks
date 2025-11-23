import boto3
from botocore.exceptions import ClientError

all_info = {
    "shortId": "all",
    "uniqueId": "all",
    "fullName": "Litter Networks"
}

def get_network_info(queryUniqueId):

    """
    Retrieve network information for a given uniqueId or return the predefined "all" network info.
    
    Parameters:
        queryUniqueId (str): The uniqueId of the network to look up. Use the literal string "all" to retrieve the predefined summary for all networks.
    
    Returns:
        dict: If a matching item exists in the LN-NetworksInfo table, the item's attributes are returned as a dictionary. If no item is found or an error occurs, returns a dictionary with an "Error" key and a descriptive message (e.g., {"Error": "No item found for uniqueId: ..."}).
    """
    if queryUniqueId=="all":
        global all_info
        return all_info

    # Initialize the DynamoDB client
    dynamodb = boto3.resource('dynamodb')
    
    # Reference the LN-NetworksInfo table
    table = dynamodb.Table('LN-NetworksInfo')
    
    try:
        # Query the table with the supplied uniqueId (hash-key)
        response = table.get_item(Key={'uniqueId': queryUniqueId})
        
        # Check if an item was found
        if 'Item' in response:
            return response['Item']
        else:
            return {"Error": f"No item found for uniqueId: {queryUniqueId}"}
    
    except ClientError as e:
        # Handle any DynamoDB errors
        return {"Error": e.response['Error']['Message']}
    except Exception as e:
        # Handle any other errors
        return {"Error": str(e)}
    
def get_all_network_ids():
   """
   Retrieve all `uniqueId` values from the LN-NetworksInfo DynamoDB table.
   
   Handles DynamoDB scan pagination to collect `uniqueId` from every item in the table.
   
   Returns:
       list: A list of `uniqueId` strings from all items in the LN-NetworksInfo table.
   """
   # Initialize a session using AWS credentials and region.
   dynamodb = boto3.resource('dynamodb')
   # Specify your DynamoDB table name
   table_name = 'LN-NetworksInfo'
   # Define your table object
   table = dynamodb.Table(table_name)
   unique_ids = []
   
   # Start a scan of the entire table
   response = table.scan()
   data = response.get('Items', [])
   
   # Collect uniqueId from the items
   for item in data:
       unique_ids.append(item['uniqueId'])
   
   # Handle pagination in case the scan result is too large
   while 'LastEvaluatedKey' in response:
       response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
       data = response.get('Items', [])
       for item in data:
           unique_ids.append(item['uniqueId'])

   return unique_ids