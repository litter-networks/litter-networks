
import boto3
from botocore.exceptions import ClientError
from PIL import Image
from io import BytesIO

# Initialize the S3 client
s3_client = boto3.client('s3')
    
# Define S3 bucket
s3_bucket = "lnweb-public"

def image_exists_on_s3(s3_key):
    try:
        s3_client.head_object(Bucket=s3_bucket, Key=s3_key)
        return True  # Image exists
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            return False  # Image does not exist
        else:
            # Re-raise if it's a different error
            raise

def save_image_to_s3(image, s3_key):
    # Save image to a buffer (to avoid writing to local file)
    image_buffer = BytesIO()
    image.save(image_buffer, format="PNG")
    image_buffer.seek(0)
    
    # Upload the image to S3 with Cache-Control headers
    s3_client.upload_fileobj(
        image_buffer,
        s3_bucket,
        s3_key,
        ExtraArgs={
            'ContentType': 'image/png',
            'CacheControl': 'public, max-age=3600, immutable'
        }
    )

def load_image_from_s3(s3_key):
   
    try:
        response = s3_client.get_object(Bucket=s3_bucket, Key=s3_key)
        image_loaded = Image.open(BytesIO(response['Body'].read())).convert("RGBA")
    except (s3_client.exceptions.NoSuchKey, IOError):
        image_loaded = Image.new("RGBA", (400, 400), (0, 0, 0, 0))  # Transparent image
        had_errors = True

    return image_loaded
