package enhanced

import (
    "context"
    "log"
    "time"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
    pb "github.com/guidance-ai/guidance/ipc/proto" 
)

type BiasClient struct {
    conn   *grpc.ClientConn
    client pb.LogitBiasServiceClient
}

func NewBiasClient(addr string) *BiasClient {
    conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
    if err != nil {
        log.Fatalf("did not connect: %v", err)
    }
    return &BiasClient{
        conn:   conn,
        client: pb.NewLogitBiasServiceClient(conn),
    }
}

func (c *BiasClient) GetBiases(regex string, text string, vocabSize int32) map[int32]float32 {
    ctx, cancel := context.WithTimeout(context.Background(), time.Second)
    defer cancel()

    resp, err := c.client.ComputeBiases(ctx, &pb.BiasRequest{
        RegexPattern:  regex,
        GeneratedText: text,
        VocabSize:     vocabSize,
    })
    
    if err != nil {
        log.Printf("Error getting biases: %v", err)
        return nil
    }

    result := make(map[int32]float32)
    for k, v := range resp.TokenBiases {
        result[k] = v
    }
    return result
}