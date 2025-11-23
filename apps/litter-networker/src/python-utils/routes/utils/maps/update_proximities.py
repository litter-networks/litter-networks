import boto3
import json
from shapely.geometry import shape
from shapely.ops import nearest_points
from geopy.distance import geodesic
from tqdm import tqdm
from datetime import datetime

def get_dynamodb_items():
    """
    Retrieve all items from the LN-NetworksMapInfo DynamoDB table.
    
    This performs one or more scan requests (handling pagination via LastEvaluatedKey) to collect every item.
    
    Returns:
        list: A list of DynamoDB items in the low-level attribute-value format (each item is a dict as returned by boto3's scan).
    """
    dynamodb = boto3.client('dynamodb', region_name='eu-west-2')
    table_name = 'LN-NetworksMapInfo'
    response = dynamodb.scan(TableName=table_name)
    items = response['Items']

    # Handle pagination if necessary
    while 'LastEvaluatedKey' in response:
        response = dynamodb.scan(
            TableName=table_name,
            ExclusiveStartKey=response['LastEvaluatedKey']
        )
        items.extend(response['Items'])
    return items

def write_dynamodb_items(results):
    # Set up DynamoDB resource
    """
    Write proximity results to the LN-NetworksProximityInfo DynamoDB table.
    
    Each entry in `results` is upserted as an item with keys:
    - `uniqueId`: the item identifier (table primary key),
    - `nearbyNetworks`: JSON string of the nearby networks list,
    - `lastUpdated`: timestamp in "YYYY-MM-DD HH:MM:SS" format (UTC-local time of invocation).
    
    Parameters:
        results (dict): Mapping from `uniqueId` (str) to a sequence or structure describing nearby networks for that id.
    """
    dynamodb = boto3.resource('dynamodb', region_name='eu-west-2')
    table = dynamodb.Table('LN-NetworksProximityInfo')

    now = datetime.now()
    formatted_time = now.strftime("%Y-%m-%d %H:%M:%S")

    # Update each entry in the DynamoDB table
    for uniqueId, nearby_networks in results.items():
        # Convert the nearby networks data to a JSON string
        nearby_networks_json = json.dumps(nearby_networks)
        
        # Add or update the item in DynamoDB
        table.put_item(
            Item={
                'uniqueId': uniqueId,
                'nearbyNetworks': nearby_networks_json,
                'lastUpdated': formatted_time
            }
        )

def update_proximities():
    """
    Update nearest-network proximities for all maps: read map metadata from DynamoDB, fetch GeoJSON geometries from S3, compute pairwise distances, and write each map's five closest neighbors back to DynamoDB.
    
    For each DynamoDB item with a map source, the function loads the corresponding GeoJSON from S3, derives either a centroid for polygonal geometries or uses geometry nearest points otherwise, computes geodesic distances (miles) between items, selects the five nearest neighbors per item (rounded to three decimals), and persists the results to the proximity DynamoDB table. Items with missing mapSource or invalid/missing GeoJSON geometries are skipped and reported.
    """
    dynamodb_items = get_dynamodb_items()
    s3 = boto3.client('s3', region_name='eu-west-2')

    data_list = []

    # Process each item from DynamoDB
    for item in tqdm(dynamodb_items, desc="Loading map data from S3"):
        uniqueId = item['uniqueId']['S']
        mapFile = item.get('mapFile', {}).get('S', '')
        mapSource = item.get('mapSource', {}).get('S', '')

        if not mapSource:
            print(f"Item {uniqueId} has no mapSource. Skipping.")
            continue

        if not mapFile or mapFile == '-':
            fileName = f"{uniqueId}.json"
        else:
            fileName = mapFile

        s3_key = f"maps/{mapSource}/{fileName}"

        try:
            response = s3.get_object(Bucket='lnweb-public', Key=s3_key)
            geojson_data = json.loads(response['Body'].read())
        except Exception as e:
            print(f"Error getting geojson for {uniqueId}: {e}")
            continue

        # Get geometry
        try:
            # Extract geometry from GeoJSON data
            if 'features' in geojson_data and geojson_data['features']:
                geometry_data = geojson_data['features'][0]['geometry']
            elif 'geometries' in geojson_data:
                geometry_data = geojson_data['geometries'][0]
            elif 'geometry' in geojson_data:
                geometry_data = geojson_data['geometry']
            else:
                print(f"No geometry found in GeoJSON data for {uniqueId}. Skipping.")
                continue

            geometry = shape(geometry_data)
        except Exception as e:
            print(f"Error parsing geometry for {uniqueId}: {e}")
            continue

        # Determine geometry type
        geom_type = geometry.geom_type

        # For polygons, get centroid
        if geom_type in ['Polygon', 'MultiPolygon']:
            centroid = geometry.centroid
        else:
            centroid = None  # For lines, centroid is not needed

        data_list.append({
            'uniqueId': uniqueId,
            'geometry': geometry,
            'centroid': centroid,
            'geom_type': geom_type
        })

    results = {}

    # Compute distances between items
    for i in tqdm(range(len(data_list)), desc='Processing items'):
        item_i = data_list[i]
        uniqueId_i = item_i['uniqueId']
        geom_i = item_i['geometry']
        centroid_i = item_i['centroid']
        geom_type_i = item_i['geom_type']

        distances = []

        for j in range(len(data_list)):
            if i == j:
                continue  # Skip self

            item_j = data_list[j]
            uniqueId_j = item_j['uniqueId']
            geom_j = item_j['geometry']
            centroid_j = item_j['centroid']
            geom_type_j = item_j['geom_type']

            if geom_type_i in ['Polygon', 'MultiPolygon'] and geom_type_j in ['Polygon', 'MultiPolygon']:
                # Both are polygons, use centroids
                point_i = (centroid_i.y, centroid_i.x)
                point_j = (centroid_j.y, centroid_j.x)
                distance_miles = geodesic(point_i, point_j).miles

            else:
                # At least one is a line, compute nearest points
                nearest_geom_i, nearest_geom_j = nearest_points(geom_i, geom_j)
                point_i = (nearest_geom_i.y, nearest_geom_i.x)
                point_j = (nearest_geom_j.y, nearest_geom_j.x)
                distance_miles = geodesic(point_i, point_j).miles

            distances.append({
                'uniqueId': uniqueId_j,
                'distance_miles': round(distance_miles, 3)
            })

        # Sort distances
        distances.sort(key=lambda x: x['distance_miles'])

        # Get 5 closest
        closest_5 = distances[:5]

        results[uniqueId_i] = closest_5

    # Output results to a JSON file (debug only)
    # with open('output_results.json', 'w') as outfile:
    #     json.dump(results, outfile, indent=2)

    write_dynamodb_items(results)

if __name__ == "__main__":
    update_proximities()