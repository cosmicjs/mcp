target "mcp" {
    dockerfile = "./Dockerfile"
    context = "."
    platforms = ["linux/amd64"]
}
