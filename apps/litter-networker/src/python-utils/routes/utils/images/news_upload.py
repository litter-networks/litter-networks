# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

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
    """
    Return a 16-character hexadecimal identifier derived from an image URL.
    
    Parameters:
        url (str): The image URL to hash.
    
    Returns:
        str: A 16-character lowercase hexadecimal string consisting of the first 16 characters of the SHA-256 hex digest of `url`.
    """
    return hashlib.sha256(url.encode()).hexdigest()[:16]  # 16 characters hash

# Resize image if necessary
def resize_image(image, width):
    """
    Resize an image down to a maximum width while preserving its aspect ratio.
    
    Parameters:
        image (PIL.Image.Image): Source image to resize.
        width (int): Target maximum width in pixels; image is only scaled if its width is greater than this value.
    
    Returns:
        PIL.Image.Image: Resized image using Lanczos resampling if scaling was performed, otherwise the original image.
    """
    if image.width > width:
        ratio = width / image.width
        new_height = int(image.height * ratio)
        return image.resize((width, new_height), Image.Resampling.LANCZOS)
    return image

# Check if file exists in S3
def file_exists_in_s3(bucket, key):
    """
    Check whether an object exists in the specified S3 bucket at the given key.
    
    Parameters:
        bucket (str): Name of the S3 bucket.
        key (str): S3 object key to check.
    
    Returns:
        bool: `True` if the object exists, `False` otherwise.
    """
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except s3.exceptions.ClientError:
        return False

# Download image from the given URL
def download_image(url):
    """
    Download an image from the given URL and return it as a PIL Image.
    
    Parameters:
        url (str): The HTTP(S) URL of the image to download.
    
    Returns:
        Image.Image: A PIL Image object opened from the downloaded content.
    
    Raises:
        Exception: If the HTTP GET response status is not 200.
    """
    response = requests.get(url)
    if response.status_code == 200:
        return Image.open(BytesIO(response.content))
    else:
        raise Exception(f"Failed to download image: {url}")

# Main function to process images
def process_images(force=False):
    # Scan the DynamoDB table
    """
    Process image URLs stored in the DynamoDB table and upload resized JPEGs to S3.
    
    Scans all items in the configured DynamoDB table, and for each item with an `imageUrl`:
    - Computes a deterministic hashed filename and target S3 key.
    - Skips uploading if the S3 key already exists unless `force` is True.
    - Downloads the image, resizes it to the configured target width, encodes it as JPEG, and uploads it to the configured S3 bucket with content type `image/jpeg`.
    - Prints progress messages for skipped, uploaded, and error cases.
    
    Parameters:
    	force (bool): If True, reprocess and upload images even when the target S3 key already exists. Defaults to False.
    """
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
