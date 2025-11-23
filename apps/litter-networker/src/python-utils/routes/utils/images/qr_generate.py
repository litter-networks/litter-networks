import requests
from PIL import Image
from io import BytesIO
import boto3
from botocore.exceptions import ClientError

from routes.utils.info.network_info import get_network_info, get_all_network_ids
from routes.utils.images.image_utils import save_image_to_s3, image_exists_on_s3

def generate_qr(network, no_background=False, force_generate=False):

    """
    Generate a QR code image for the given network and upload it to S3.
    
    Parameters:
    	network (str): Network identifier to encode in the QR (use "all" to encode the base URL without a network suffix).
    	no_background (bool): If True, remove the image background (make non-black pixels transparent) before saving.
    	force_generate (bool): If True, regenerate and overwrite the image on S3 even if it already exists.
    
    Raises:
    	Exception: If the remote QR service returns a non-200 response when fetching the QR image.
    """
    is_all = ( network == "all" )

    # firstly let's generate output file-path...    
    s3_key = f"proc/images/resources/qr/qr-{network}.png" if not no_background else f"proc/images/resources/qr/qr-{network}-nobg.png"

    # ... and see if they already exist on s3:
    if force_generate is False:
        if image_exists_on_s3(s3_key):
            return

    # Retrieve network information (dummy data here, replace with real logic if needed)
    selected_network_info = get_network_info(network)
    selected_network_short_name = selected_network_info["shortId"]

    # Construct the QR code image URL
    image_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=http%3A%2F%2Fwww.litternetworks.org"
    
    if not is_all:
        image_url += "/" + selected_network_short_name

    # Fetch the QR code image
    response = requests.get(image_url)
    if response.status_code != 200:
        raise Exception(f"Error fetching image: {response.status_code}")
    
    image = Image.open(BytesIO(response.content))
    
    # If no background flag is set, remove the background
    if no_background:
        image = remove_background(image)
    
    # save image to s3:
    save_image_to_s3(image, s3_key)

def remove_background(image):
    """
    Convert all non-black pixels in the image to fully transparent.
    
    Parameters:
        image (PIL.Image.Image): Image to process; will be converted to RGBA if needed.
    
    Returns:
        PIL.Image.Image: The same image object with every pixel whose RGB components are not all zero replaced by (0, 0, 0, 0) (fully transparent).
    """
    image = image.convert("RGBA")
    width, height = image.size
    
    # Loop through each pixel and make non-black pixels transparent
    for y in range(height):
        for x in range(width):
            r, g, b, a = image.getpixel((x, y))
            if r != 0 or g != 0 or b != 0:
                image.putpixel((x, y), (0, 0, 0, 0))  # Make pixel fully transparent
    
    return image

def main():

    """
    Run QR generation in either single-file or multi-file mode.
    
    By default runs in single-file mode and generates a QR with a transparent background for the network "anfieldlitter". In multi-file mode it retrieves all network IDs, iterates with a progress indicator, and generates both background and transparent-background QR images for each network.
    """
    isSingleFileMode = True

    if isSingleFileMode:
        generate_qr("anfieldlitter", no_background=True)
    else:
        # Fetch all uniqueIds from the table
        unique_ids = get_all_network_ids()

        from tqdm import tqdm
        
        # Loop over each uniqueId and perform the desired action
        for unique_id in tqdm(unique_ids, desc="Processing Flyer Images"):
            generate_qr(unique_id, no_background=False)
            generate_qr(unique_id, no_background=True)

if __name__ == '__main__':
    main()
