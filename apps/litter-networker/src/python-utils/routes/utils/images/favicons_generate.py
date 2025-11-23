from PIL import Image, ImageDraw
import os

from routes.utils.images.image_utils import save_image_to_s3

# Define the required icon sizes
icon_sizes = [
    (512, 512), (192, 192), (180, 180), (144, 144), (96, 96),
    (72, 72), (48, 48), (32, 32), (16, 16)
]

# Define input and output paths

base_dir = os.path.dirname(os.path.abspath(__file__))
input_image_path = os.path.join(base_dir, "source", "favicon-source.png")
output_dir = "proc/images/icons/"

# Create the output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

# Open the input image
with Image.open(input_image_path) as img:
    # Ensure the input image is square
    if img.width != img.height:
        raise ValueError("Input image must be square.")

    # Create a mask with smooth rounded corners
    mask = Image.new("L", (img.width, img.height), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, img.width, img.height), radius=45, fill=255)
        
    # Apply anti-aliasing by resizing mask to a larger size first, then back down to smooth edges
    mask = mask.resize((img.width * 2, img.height * 2), Image.LANCZOS).resize((img.width, img.height), Image.LANCZOS)

    # Apply the mask for rounded corners
    img.putalpha(mask)

    # Generate icons in the specified sizes
    for size in icon_sizes:
        # Resize the image
        resized_img = img.resize(size, Image.LANCZOS)
        
        # Ensure the resized image retains transparency and rounded corners
        rounded_icon = Image.new("RGBA", size)
        rounded_icon.paste(resized_img, (0, 0), resized_img)

        # Save the resized image with the size in the filename
        s3_key = output_dir + f"icon-{size[0]}x{size[1]}.png"
        save_image_to_s3(rounded_icon, s3_key)

        print(f"Saved icon to s3: {s3_key}")

        # Create a black-and-white version while retaining transparency
        # Split the RGBA channels
        r, g, b, alpha = rounded_icon.split()

        # Merge grayscale RGB channels back with original alpha channel
        bw_rgb = Image.merge("RGB", (r, g, b)).convert("L")  # Convert to grayscale
        bw_icon = Image.merge("RGBA", (bw_rgb, bw_rgb, bw_rgb, alpha))  # Reassemble with the alpha channel

        # Save the black-and-white icon
        bw_s3_key = output_dir + f"icon-{size[0]}x{size[1]}-bw.png"
        save_image_to_s3(bw_icon, bw_s3_key)
        print(f"Saved black-and-white icon to s3: {bw_s3_key}")
        
print("Icon generation complete.")
