terraform apply

if [ $? -ne 0 ]; then
    echo "Terraform apply failed. Exiting..."
    exit 1
fi

echo ""
echo "Cloudfront Invalidation for Dynamic distro... ========================="
aws cloudfront create-invalidation --distribution-id E38XGOGM7XNRC5 --paths "/*" > /dev/null 2>&1

echo ""
echo "Cloudfront Invalidation for Static distro... ========================="
aws cloudfront create-invalidation --distribution-id EWXIG6ZADYHMA --paths "/*" > /dev/null 2>&1

