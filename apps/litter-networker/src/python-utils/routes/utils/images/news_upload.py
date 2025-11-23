import boto3
import hashlib
import requests
from PIL import Image
from io import BytesIO
import os

# Initialize boto3 clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

# Configuration
DYNAMODB_TABLE = 'LN-PressCuttings'
S3_BUCKET = 'lnweb-public'
S3_PREFIX = 'proc/images/news/'
TARGET_WIDTH = 800

# DynamoDB table
table = dynamodb.Table(DYNAMODB_TABLE)

# Hash function
def hash_image_url(url):
    return hashlib.sha256(url.encode()).hexdigest()[:16]  # 16 characters hash

# Resize image if necessary
def resize_image(image, width):
    if image.width > width:
        ratio = width / image.width
        new_height = int(image.height * ratio)
        return image.resize((width, new_height), Image.Resampling.LANCZOS)
    return image

# Check if file exists in S3
def file_exists_in_s3(bucket, key):
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except s3.exceptions.ClientError:
        return False

# Download image from the given URL
def download_image(url):
    response = requests.get(url)
    if response.status_code == 200:
        return Image.open(BytesIO(response.content))
    else:
        raise Exception(f"Failed to download image: {url}")

# Main function to process images
def process_images(force=False):
    # Scan the DynamoDB table
    response = table.scan()
    for item in response['Items']:
        image_url = item.get('imageUrl')
        if image_url:
            hashed_image_name = hash_image_url(image_url)
            s3_key = f"{S3_PREFIX}{hashed_image_name}.jpg"

            # Skip if file exists and force is not set
            if not force and file_exists_in_s3(S3_BUCKET, s3_key):
                print(f"File already exists: {s3_key}, skipping.")
                continue

            try:
                # Download and process the image
                image = download_image(image_url)
                resized_image = resize_image(image, TARGET_WIDTH)

                # Save the image to a buffer
                buffer = BytesIO()
                resized_image.save(buffer, format="JPEG")
                buffer.seek(0)

                # Upload to S3
                s3.put_object(Bucket=S3_BUCKET, Key=s3_key, Body=buffer, ContentType='image/jpeg')
                print(f"Uploaded: {s3_key}")

            except Exception as e:
                print(f"Error processing image {image_url}: {str(e)}")

if __name__ == "__main__":
    import argparse

    # Add option to force re-upload
    parser = argparse.ArgumentParser(description="Process images from DynamoDB to S3")
    parser.add_argument('--force', action='store_true', help="Force upload even if the file exists in S3")
    args = parser.parse_args()

    process_images(force=args.force)
